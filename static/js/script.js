$(document).ready(function () {

  class Inference {
    constructor(video, info) {
      this.defaultInfo = {
        facingMode: "user",
        // width: 640,
        // height: 480
      };
      this.video = video;
      this.elapsed_time = 0;
      this.time = 0;
      this.info = Object.assign(Object.assign({}, this.defaultInfo), info);
    }

    run(stream) {
      this.video.srcObject = stream;
      this.video.onloadedmetadata = () => {
        this.video.play();
        this.captureStatus()
      }
    }

    captureStatus() {
      this.time++;  // 帧数记录
      window.requestAnimationFrame(() => {
        this.forward()
      })
    }

    forward() {
      // 人体关键点检测
      var faceMeshInfer = null;
      this.video.paused || this.video.currentTime === this.elapsed_time || (this.elapsed_time = this.video.currentTime, faceMeshInfer = this.info.faceMeshInfer());
      faceMeshInfer ? faceMeshInfer.then(() => {
        this.captureStatus()
      }) : this.captureStatus()
    }

    async start() {
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia || alert("No navigator.mediaDevices.getUserMedia exists.");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.info.facingMode,
            width: this.info.width,
            height: this.info.height
          }
        });
        this.run(stream);
      } catch (c) {
        console.error("Failed to acquire camera feed: " + c);
        alert("Failed to acquire camera feed: " + c);
        throw c;
      }
    }
  }

  function faceMeshResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    realLandmarks = []
    if (results.multiFaceLandmarks) {
      landmarks = results.multiFaceLandmarks[0]
      if (!landmarks) {
        return
      }
      for (point of landmarks) {
        point.x = 1 - point.x  // 水平翻转
        realLandmarks.push([point.x * canvasElement.width, point.y * canvasElement.height])
      }

      drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
        { color: '#C0C0C070', lineWidth: 1 });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#FF3030' });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, { color: '#FF3030' });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, { color: '#FF3030' });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30' });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, { color: '#30FF30' });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, { color: '#30FF30' });
      drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#E0E0E0' });
    }

    // 到此处证明已经检测到人脸，开始判断动作
    if (currentActionType == -1) {
      // 随机选择一个动作
      currentActionType = Math.floor(Math.random() * 4)
      actionInstruction.innerHTML = actionType[currentActionType]
    }

    let flag = false

    // 根据不同的动作类型，判断是否完成
    if (currentActionType == 0) {
      // 眨眼
      if (eyeAspectRation(realLandmarks) < 0.2) {
        flag = true
      }
    } else if (currentActionType == 1) {
      // 张嘴
      if (mouthAspectRatio(realLandmarks) > 0.6) {
        flag = true
      }
    } else if (currentActionType == 2) {
      // 摇头
      let points = getPoint5(realLandmarks)
      let angle = getPoint5Angle(points)
      if (angle[2] > 60) {
        flag = true
      }
    } else if (currentActionType == 3) {
      // 点头
      let points = getPoint5(realLandmarks)
      let angle = getPoint5Angle(points)
      if (angle[1] > 30) {
        flag = true
      }
    }

    if (flag) {
      // 意味着动作已经完成，重置状态
      currentActionType = -1
      completedActionCount.innerHTML = parseInt(completedActionCount.innerHTML) + 1
      actionInstruction.innerHTML = "请稍等..."
      setTimeout(() => {
        actionInstruction.innerHTML = actionType[currentActionType]
      }, 2000)
    }

    // $.post("/faceMesh", {
    //     pose_landmarks: JSON.stringify(results.multiFaceLandmarks),
    //     width: canvasElement.width,
    //     height: canvasElement.height
    // }, function (err, req, resp) {
    //     console.log(resp);
    // });
  }

  function get2PointsNorm(p1, p2) {
    let sum = 0
    for (let index = 0; index < p1.length; index++) {
      sum += Math.pow(p1[index] - p2[index], 2)
    }
    return Math.sqrt(sum)
  }

  function get4PointsAspectRatio(points) {
    let v1 = get2PointsNorm(points[0], points[4])
    let h1 = get2PointsNorm(points[1], points[5])
    let h2 = get2PointsNorm(points[2], points[6])
    let h3 = get2PointsNorm(points[3], points[7])
    return (h1 + h2 + h3) / (3 * v1)
  }

  function eyeAspectRation(landmarks) {

    let leftEyePoints = [landmarks[263], landmarks[385], landmarks[386], landmarks[387], landmarks[362], landmarks[380], landmarks[374], landmarks[373]]
    let leftEyeAspectRatio = get4PointsAspectRatio(leftEyePoints)

    let rightEyePoints = [landmarks[33], landmarks[160], landmarks[159], landmarks[158], landmarks[133], landmarks[144], landmarks[145], landmarks[153]]
    let rightEyeAspectRatio = get4PointsAspectRatio(rightEyePoints)
    return (leftEyeAspectRatio + rightEyeAspectRatio) / 2
  }

  function mouthAspectRatio(landmarks) {
    let mouthPoints = [landmarks[61], landmarks[81], landmarks[13], landmarks[311], landmarks[291], landmarks[178], landmarks[14], landmarks[402]]
    return get4PointsAspectRatio(mouthPoints)
  }

  function getPoint5(landmarks) {
    let point5 = []
    point5.push(landmarks[468])
    point5.push(landmarks[473])
    point5.push(landmarks[4])
    point5.push(landmarks[61])
    point5.push(landmarks[291])
    return point5
  }

  function getPoint5Angle(points) {
    let LMx = []
    let LMy = []
    for (let index = 0; index < points.length; index++) {
      LMx.push(points[index][0])
      LMy.push(points[index][1])
    }

    let dPx_eyes = Math.max((LMx[1] - LMx[0]), 1.0)
    let dPy_eyes = LMy[1] - LMy[0]
    let angle = Math.atan(dPy_eyes / dPx_eyes)

    let alpha = Math.cos(angle)
    let beta = Math.sin(angle)

    // Rotate the point
    let LMRx = []
    let LMRy = []
    for (let index = 0; index < points.length; index++) {
      LMRx.push(alpha * LMx[index] + beta * LMy[index] + (1 - alpha) * LMx[2] / 2 - beta * LMy[2] / 2)
      LMRy.push(-beta * LMx[index] + alpha * LMy[index] + beta * LMx[2] / 2 + (1 - alpha) * LMy[2] / 2)
    }

    // Average distance between eyes and mouth
    let dXtot = (LMRx[1] - LMRx[0] + LMRx[4] - LMRx[3]) / 2
    let dYtot = (LMRy[3] - LMRy[0] + LMRy[4] - LMRy[1]) / 2

    // Average distance between nose and eyes
    let dXnose = (LMRx[1] - LMRx[2] + LMRx[4] - LMRx[2]) / 2
    let dYnose = (LMRy[3] - LMRy[2] + LMRy[4] - LMRy[2]) / 2

    // Relative rotaion of the face
    let Xfrontal = dXtot != 0 ? (-90 + 90 / 0.5 * dXnose / dXtot) : 0
    let Yfrontal = dYtot != 0 ? (-90 + 90 / 0.5 * dYnose / dYtot) : 0

    let roll = angle * 180 / Math.PI
    let pitch = Yfrontal
    let yaw = Xfrontal

    return [roll, pitch, yaw]
  }

  const videoElement = document.getElementById("video")
  const canvasElement = document.getElementById("own_canvas")
  const canvasCtx = canvasElement.getContext("2d")

  const completedActionCount = document.getElementById("actionCount")
  const actionInstruction = document.getElementById("instruction")

  // 定义动作类型
  const actionType = {
    0: "请眨眼",
    1: "请张嘴",
    2: "请摇头",
    3: "请点头"
  }

  currentActionType = -1;

  // 人脸网格
  const faceMesh = new FaceMesh({
    locateFile: (file) => {
      return `/resource/${file}`;
    }
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    useCpuInference: true
  });

  faceMesh.onResults(faceMeshResults);

  const inference = new Inference(videoElement, {
    faceMeshInfer: async () => {
      await faceMesh.send({ image: videoElement });
    },
    // width: 720,
    // height: 560
  });
  inference.start();
});