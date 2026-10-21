// Thin MindAR + Three.js wrapper. MindAR's bundled MindARThree targets an old
// three.js API (sRGBEncoding was removed in r162), so we drive MindAR's
// Controller directly and keep the camera maths from its three.js integration.
import { Controller } from 'mind-ar/dist/mindar-image.prod.js';
import { Group, Matrix4, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer } from 'three';

export class ImageTracker {
  constructor({ container, targetSrc, tracking }) {
    this.container = container;
    this.targetSrc = targetSrc;
    this.tracking = tracking;
    this.anchors = [];

    this.scene = new Scene();
    this.camera = new PerspectiveCamera();
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.className = 'ar-canvas';
    container.appendChild(this.renderer.domElement);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  // anchor.group is positioned so the target spans x,y in [-0.5, 0.5] * [1, h/w].
  addAnchor(targetIndex = 0) {
    const group = new Group();
    group.visible = false;
    group.matrixAutoUpdate = false;
    const anchor = { group, targetIndex, visible: false, onTargetFound: null, onTargetLost: null };
    this.anchors.push(anchor);
    this.scene.add(group);
    return anchor;
  }

  // Must be called from a user gesture on iOS. Rejects with the getUserMedia error.
  async startCamera() {
    const video = document.createElement('video');
    video.className = 'camera-feed';
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    this.container.prepend(video);
    this.video = video;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.srcObject = stream;
    await new Promise((resolve) => {
      if (video.readyState >= 1) resolve();
      else video.addEventListener('loadedmetadata', resolve, { once: true });
    });
    // MindAR draws frames using the element's width/height attributes, not videoWidth.
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    await video.play().catch(() => {});
  }

  async startTracking() {
    const { video } = this;
    this.controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: 1,
      ...this.tracking,
      onUpdate: (data) => {
        if (data.type === 'updateMatrix') this._onMatrix(data.targetIndex, data.worldMatrix);
      },
    });
    this.resize();

    const { dimensions } = await this.controller.addImageTargets(this.targetSrc);
    // Map MindAR's pixel space to "target width = 1 unit, centred".
    this.postMatrices = dimensions.map(([w, h]) => {
      const m = new Matrix4();
      m.compose(new Vector3(w / 2, h / 2, 0), new Quaternion(), new Vector3(w, w, w));
      return m;
    });
    this.targetDimensions = dimensions;

    await this.controller.dummyRun(video);
    this.controller.processVideo(video);
    this.renderer.setAnimationLoop((t) => {
      this.onBeforeRender?.(t);
      this.renderer.render(this.scene, this.camera);
    });
  }

  _onMatrix(targetIndex, worldMatrix) {
    for (const anchor of this.anchors) {
      if (anchor.targetIndex !== targetIndex) continue;
      const found = worldMatrix !== null;
      anchor.group.visible = found;
      if (found) {
        const m = new Matrix4();
        m.elements = [...worldMatrix];
        m.multiply(this.postMatrices[targetIndex]);
        anchor.group.matrix = m;
        anchor.group.matrixWorldNeedsUpdate = true;
      }
      if (found && !anchor.visible) {
        anchor.visible = true;
        anchor.onTargetFound?.();
      } else if (!found && anchor.visible) {
        anchor.visible = false;
        anchor.onTargetLost?.();
      }
    }
  }

  // Cover-fit the camera feed to the container and match the three.js camera to it.
  // Ported from MindAR's three.js integration.
  resize() {
    const { container, video, controller, camera, renderer } = this;
    if (!video || !controller) return;
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = cw / ch;
    let vw, vh;
    if (videoRatio > containerRatio) {
      vh = ch;
      vw = vh * videoRatio;
    } else {
      vw = cw;
      vh = vw / videoRatio;
    }

    const proj = controller.getProjectionMatrix();
    const inputRatio = controller.inputWidth / controller.inputHeight;
    let displayHeight;
    if (inputRatio > containerRatio) {
      displayHeight = ch * (video.videoWidth / controller.inputWidth);
    } else {
      displayHeight = (cw / controller.inputWidth) * controller.inputHeight * (video.videoHeight / controller.inputHeight);
    }
    const fovAdjust = ch / displayHeight;

    camera.fov = (2 * Math.atan((1 / proj[5]) * fovAdjust) * 180) / Math.PI;
    camera.near = proj[14] / (proj[10] - 1.0);
    camera.far = proj[14] / (proj[10] + 1.0);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();

    Object.assign(video.style, {
      top: `${-(vh - ch) / 2}px`,
      left: `${-(vw - cw) / 2}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    });
    renderer.setSize(cw, ch);
  }
}
