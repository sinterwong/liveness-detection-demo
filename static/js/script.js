$(document).ready(function () {
    const videoElement = document.getElementById("video");
    const canvasElement = document.getElementById("own_canvas");
    const canvasCtx = canvasElement.getContext("2d");
    const completedActionCount = document.getElementById("actionCount");
    const actionInstruction = document.getElementById("instruction");

    const actionType = {
        0: "Please blink",
        1: "Please open your mouth",
        2: "Please shake your head",
        3: "Please nod"
    };

    let currentActionType = -1;
    let realLandmarks = [];

    // --- Face Mesh Initialization ---
    const faceMesh = new FaceMesh({
        locateFile: (file) => `./resource/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        useCpuInference: true
    });

    faceMesh.onResults(onFaceMeshResults);

    // --- Camera and Inference ---
    class Inference {
        constructor(video, options) {
            this.video = video;
            this.options = { ...options };
        }

        async start() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" }
                });
                this.video.srcObject = stream;
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    this.captureStatus();
                };
            } catch (err) {
                console.error("Failed to acquire camera feed: ", err);
                alert("Failed to acquire camera feed: " + err);
                throw err;
            }
        }

        captureStatus() {
            window.requestAnimationFrame(() => this.forward());
        }

        async forward() {
            if (this.video.paused || this.video.ended) return;
            await this.options.faceMeshInfer();
            this.captureStatus();
        }

        stop() {
            this.video.pause();
            if (this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
            }
        }
    }

    const inference = new Inference(videoElement, {
        faceMeshInfer: async () => {
            await faceMesh.send({ image: videoElement });
        }
    });

    inference.start();

    // --- Liveness Detection Logic ---
    function onFaceMeshResults(results) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        realLandmarks = [];

        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const landmarks = results.multiFaceLandmarks[0];
            processLandmarks(landmarks);
            drawLandmarks(landmarks);
            checkLiveness();
        }
    }

    function processLandmarks(landmarks) {
        for (const point of landmarks) {
            realLandmarks.push([
                point.x * 100,
                point.y * 100 * (canvasElement.height / canvasElement.width)
            ]);
        }
    }

    const completedActions = new Set();

    function checkLiveness() {
        if (completedActions.size === 4) {
            actionInstruction.innerHTML = "All actions completed! Thank you.";
            actionInstruction.style.color = "green";
            inference.stop();
            return;
        }

        if (currentActionType === -1) {
            let nextAction;
            do {
                nextAction = Math.floor(Math.random() * 4);
            } while (completedActions.has(nextAction));
            currentActionType = nextAction;
            actionInstruction.innerHTML = actionType[currentActionType];
        }

        let actionCompleted = false;
        switch (currentActionType) {
            case 0: // Blink
                if (eyeAspectRatio(realLandmarks) < 0.2) actionCompleted = true;
                break;
            case 1: // Open mouth
                if (mouthAspectRatio(realLandmarks) > 0.6) actionCompleted = true;
                break;
            case 2: // Shake head
                const [, , yaw] = getHeadPoseAngles(realLandmarks);
                if (Math.abs(yaw) > 30) actionCompleted = true;
                break;
            case 3: // Nod
                const [, pitch] = getHeadPoseAngles(realLandmarks);
                if (Math.abs(pitch) > 30) actionCompleted = true;
                break;
        }

        if (actionCompleted) {
            alert("Action completed!");
            completedActions.add(currentActionType);
            completedActionCount.innerHTML = completedActions.size;
            currentActionType = -1;
            actionInstruction.innerHTML = "Please wait...";
            setTimeout(() => {
                if (currentActionType === -1 && completedActions.size < 4) {
                    actionInstruction.innerHTML = "Please look at the screen";
                }
            }, 2000);
        }
    }

    // --- Drawing ---
    function drawLandmarks(landmarks) {
        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#FF3030' });
        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, { color: '#FF3030' });
        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, { color: '#FF3030' });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30' });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, { color: '#30FF30' });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, { color: '#30FF30' });
        drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#E0E0E0' });
    }

    // --- Utility Functions ---
    function get2PointsNorm(p1, p2) {
        return Math.sqrt(p1.reduce((sum, val, i) => sum + (val - p2[i]) ** 2, 0));
    }

    function get4PointsAspectRatio(points) {
        const v1 = get2PointsNorm(points[0], points[4]);
        const h1 = get2PointsNorm(points[1], points[5]);
        const h2 = get2PointsNorm(points[2], points[6]);
        const h3 = get2PointsNorm(points[3], points[7]);
        return (h1 + h2 + h3) / (3 * v1);
    }

    function eyeAspectRatio(landmarks) {
        const leftEyePoints = [landmarks[263], landmarks[385], landmarks[386], landmarks[387], landmarks[362], landmarks[380], landmarks[374], landmarks[373]];
        const leftEAR = get4PointsAspectRatio(leftEyePoints);

        const rightEyePoints = [landmarks[33], landmarks[160], landmarks[159], landmarks[158], landmarks[133], landmarks[144], landmarks[145], landmarks[153]];
        const rightEAR = get4PointsAspectRatio(rightEyePoints);

        return (leftEAR + rightEAR) / 2;
    }

    function mouthAspectRatio(landmarks) {
        const mouthPoints = [landmarks[61], landmarks[81], landmarks[13], landmarks[311], landmarks[291], landmarks[178], landmarks[14], landmarks[402]];
        return get4PointsAspectRatio(mouthPoints);
    }

    function getHeadPoseAngles(landmarks) {
        const point5 = [landmarks[468], landmarks[473], landmarks[4], landmarks[61], landmarks[291]];
        const lmX = point5.map(p => p[0]);
        const lmY = point5.map(p => p[1]);

        const dPxEyes = Math.max(lmX[1] - lmX[0], 1.0);
        const dPyEyes = lmY[1] - lmY[0];
        const angle = Math.atan(dPyEyes / dPxEyes);
        const alpha = Math.cos(angle);
        const beta = Math.sin(angle);

        const lmRx = lmX.map((x, i) => alpha * x + beta * lmY[i] + (1 - alpha) * lmX[2] / 2 - beta * lmY[2] / 2);
        const lmRy = lmY.map((y, i) => -beta * lmX[i] + alpha * y + beta * lmX[2] / 2 + (1 - alpha) * lmY[2] / 2);

        const dXtot = (lmRx[1] - lmRx[0] + lmRx[4] - lmRx[3]) / 2;
        const dYtot = (lmRy[3] - lmRy[0] + lmRy[4] - lmRy[1]) / 2;
        const dXnose = (lmRx[1] - lmRx[2] + lmRx[4] - lmRx[2]) / 2;
        const dYnose = (lmRy[3] - lmRy[2] + lmRy[4] - lmRy[2]) / 2;

        const yaw = dXtot !== 0 ? (-90 + 90 / 0.5 * dXnose / dXtot) : 0;
        const pitch = dYtot !== 0 ? (-90 + 90 / 0.5 * dYnose / dYtot) : 0;
        const roll = angle * 180 / Math.PI;

        return [roll, pitch, yaw];
    }
});