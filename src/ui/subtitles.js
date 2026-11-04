import * as THREE from 'three';

const FONT = "'Nanum Brush Script', 'Nanum Myeongjo', serif";

/** 카메라 앞에 붙는 붓글씨 자막. VR과 노트북에서 똑같이 보인다. */
export function createSubtitles(engine) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0, fog: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.1), mat);
  plane.position.set(0, -0.13, -0.6);
  plane.renderOrder = 1001;
  engine.camera.add(plane);
  let left = 0;
  let total = 1;

  function draw(text) {
    g.clearRect(0, 0, c.width, c.height);
    const grad = g.createLinearGradient(0, 0, c.width, 0);
    grad.addColorStop(0, 'rgba(10,9,7,0)'); grad.addColorStop(0.15, 'rgba(10,9,7,.55)');
    grad.addColorStop(0.85, 'rgba(10,9,7,.55)'); grad.addColorStop(1, 'rgba(10,9,7,0)');
    g.fillStyle = grad; g.fillRect(0, 30, c.width, 100);
    g.font = `64px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#efe6d2';
    g.fillText(text, c.width / 2, 82);
    tex.needsUpdate = true;
  }

  return {
    show(text, seconds = 4) { draw(text); left = total = seconds; },
    clear() { left = 0; mat.opacity = 0; },
    update(dt) {
      if (left <= 0) { mat.opacity = 0; return; }
      left -= dt;
      const t = total - left;
      mat.opacity = Math.min(1, t / 0.5, Math.max(0, left) / 0.6);
    },
  };
}
