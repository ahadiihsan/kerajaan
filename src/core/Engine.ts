import * as THREE from 'three';
import { clamp, easeIO, lerp, R, V3 } from '../utils/math';
import { world } from './WorldState';

export interface CameraGoal {
  yaw: number;
  pitch: number;
  dist: number;
  fov: number;
  target: THREE.Vector3;
}

export interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  ease: (t: number) => number;
  res: () => void;
}

export class Engine {
  public readonly canvas: HTMLCanvasElement;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly camRight = new V3(1, 0, 0);
  public readonly dbs = new THREE.Vector2();
  public cam: CameraGoal;
  public goal: CameraGoal;
  public lastInput = -10;

  private readonly tweens: Tween[] = [];
  private readonly post: {
    resize: (w: number, h: number, pr: number) => void;
    render: () => void;
  };

  constructor(canvas: HTMLCanvasElement, tint: THREE.Vector3, initialTarget: THREE.Vector3) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x9fb8d8, 90, 220);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 1400);
    this.cam = { yaw: 0.62, pitch: 0.66, dist: 23, fov: 30, target: initialTarget.clone() };
    this.goal = {
      yaw: this.cam.yaw,
      pitch: this.cam.pitch,
      dist: this.cam.dist,
      fov: this.cam.fov,
      target: this.cam.target.clone(),
    };
    this.camera.fov = this.cam.fov;
    this.camera.updateProjectionMatrix();

    this.post = this.createPostProcess(tint);
  }

  private createPostProcess(tint: THREE.Vector3) {
    const rtA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    const rtB = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
    const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
    const TILT = `uniform sampler2D tDiffuse; uniform vec2 dir,res; uniform float focus,band,strength,pr; varying vec2 vUv;
      vec3 tilt(){ float d=abs(vUv.y-focus); float amt=smoothstep(band,band+.34,d)*strength + length((vUv-.5)*vec2(1.,0.))*.25*strength;
        vec2 st=dir/res*amt*2.3*pr; vec3 s=texture2D(tDiffuse,vUv).rgb*.1964825501511404;
        s+=(texture2D(tDiffuse,vUv+st*1.411764705882353).rgb+texture2D(tDiffuse,vUv-st*1.411764705882353).rgb)*.2969069646728344;
        s+=(texture2D(tDiffuse,vUv+st*3.2941176470588234).rgb+texture2D(tDiffuse,vUv-st*3.2941176470588234).rgb)*.09447039785044732;
        s+=(texture2D(tDiffuse,vUv+st*5.176470588235294).rgb+texture2D(tDiffuse,vUv-st*5.176470588235294).rgb)*.010381362401148057;
        return s; }`;
    const uni = () => ({
      tDiffuse: { value: null as THREE.Texture | null },
      dir: { value: new THREE.Vector2(1, 0) },
      res: { value: new THREE.Vector2(1, 1) },
      focus: { value: 0.5 },
      band: { value: 0.13 },
      strength: { value: 1 },
      pr: { value: 1 },
    });
    const blur = new THREE.ShaderMaterial({
      uniforms: uni(),
      vertexShader: VS,
      fragmentShader: TILT + `void main(){ gl_FragColor=vec4(tilt(),1.); }`,
      depthTest: false,
      depthWrite: false,
    });
    const fin = new THREE.ShaderMaterial({
      uniforms: Object.assign(uni(), {
        tint: { value: tint },
        sat: { value: 1.18 },
        flash: { value: 0 },
        raid: { value: 0 },
        time: { value: 0 },
        exposure: { value: 1.1 },
      }),
      vertexShader: VS,
      depthTest: false,
      depthWrite: false,
      fragmentShader:
        TILT +
        `uniform vec3 tint; uniform float sat,flash,raid,time,exposure;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
        float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec3 c=tilt()*tint*exposure;
          c=mix(c,c*vec3(1.35,.72,.55)+vec3(.02,0.,0.),raid*.55);
          c=aces(c);
          float l=dot(c,vec3(.2126,.7152,.0722)); c=mix(vec3(l),c,sat);
          vec2 q=vUv-.5; c*=mix(1.,smoothstep(.95,.3,length(q*vec2(1.1,1.25))),.55);
          c+=flash*vec3(.55,.6,.75);
          c=pow(clamp(c,0.,1.),vec3(1./2.2));
          c+=(hash(vUv*res+time)-.5)/255.;
          gl_FragColor=vec4(c,1.); }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blur);
    const sc = new THREE.Scene();
    const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad.frustumCulled = false;
    sc.add(quad);
    return {
      resize: (w: number, h: number, pr: number) => {
        rtA.setSize(w, h);
        rtB.setSize(w, h);
        for (const m of [blur, fin]) {
          m.uniforms.res.value.set(w, h);
          m.uniforms.pr.value = pr;
        }
      },
      render: () => {
        this.renderer.setRenderTarget(rtA);
        this.renderer.render(this.scene, this.camera);
        for (const m of [blur, fin]) {
          m.uniforms.focus.value = world.focus;
          m.uniforms.strength.value = world.tilt;
        }
        blur.uniforms.tDiffuse.value = rtA.texture;
        blur.uniforms.dir.value.set(1, 0);
        quad.material = blur;
        this.renderer.setRenderTarget(rtB);
        this.renderer.render(sc, oc);
        fin.uniforms.tDiffuse.value = rtB.texture;
        fin.uniforms.dir.value.set(0, 1);
        fin.uniforms.flash.value = world.flash * 0.35;
        fin.uniforms.raid.value = world.raidAmt;
        fin.uniforms.time.value = world.T % 100;
        fin.uniforms.sat.value = 1.2 - 0.38 * world.storm;
        quad.material = fin;
        this.renderer.setRenderTarget(null);
        this.renderer.render(sc, oc);
      },
    };
  }

  public tween(dur: number, fn: (k: number) => void, ease: (t: number) => number = easeIO): Promise<void> {
    return new Promise((res) => this.tweens.push({ t: 0, dur, fn, ease, res }));
  }

  public updateTweens(dt: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.res();
      }
    }
  }

  public updateCamera(
    dt: number,
    opts: {
      followHero: boolean;
      followSelected: boolean;
      heroPos: { x: number; y: number; z: number };
      selectedPos: { x: number; y: number; z: number; hidden: boolean } | null;
      skyGroup: THREE.Group;
      sun: THREE.DirectionalLight;
      sunDir: THREE.Vector3;
      rainCenter: THREE.Vector3;
    }
  ): void {
    const k = 1 - Math.exp(-dt * 5);
    if (!opts.followHero && world.autoOrbit && world.T - this.lastInput > 6) {
      this.goal.yaw += dt * 0.035;
    }
    if (opts.followHero) {
      this.goal.target.set(opts.heroPos.x, opts.heroPos.y + 0.75, opts.heroPos.z);
    } else if (opts.followSelected && opts.selectedPos && !opts.selectedPos.hidden) {
      this.goal.target.lerp(
        new V3(opts.selectedPos.x, opts.selectedPos.y + 0.6, opts.selectedPos.z),
        1 - Math.exp(-dt * 3)
      );
    }

    this.cam.yaw = lerp(this.cam.yaw, this.goal.yaw, k);
    this.cam.pitch = lerp(this.cam.pitch, this.goal.pitch, k);
    this.cam.dist = lerp(this.cam.dist, this.goal.dist, k);
    this.cam.target.lerp(this.goal.target, k);
    if (Math.abs(this.cam.fov - this.goal.fov) > 0.01) {
      this.cam.fov = lerp(this.cam.fov, this.goal.fov, k);
      this.camera.fov = this.cam.fov;
      this.camera.updateProjectionMatrix();
    }

    const cp = Math.cos(this.cam.pitch);
    this.camera.position.set(
      this.cam.target.x + Math.sin(this.cam.yaw) * cp * this.cam.dist,
      this.cam.target.y + Math.sin(this.cam.pitch) * this.cam.dist,
      this.cam.target.z + Math.cos(this.cam.yaw) * cp * this.cam.dist
    );
    this.camera.lookAt(this.cam.target);
    if (world.shake > 0.01) {
      this.camera.position.add(new V3(R(-1, 1), R(-1, 1), R(-1, 1)).multiplyScalar(world.shake * 0.5));
      world.shake *= Math.exp(-dt * 3.5);
    }
    this.camRight.set(Math.cos(this.cam.yaw), 0, -Math.sin(this.cam.yaw));
    opts.skyGroup.position.copy(this.camera.position);
    opts.sun.target.position.copy(this.cam.target);
    opts.sun.position.copy(opts.sun.target.position).addScaledVector(opts.sunDir, 80);
    opts.rainCenter.copy(this.cam.target);
  }

  public resize(onPixelRatio?: (pr: number) => void): void {
    const pr = Math.min(window.devicePixelRatio || 1, 2, 2560 / window.innerWidth);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.getDrawingBufferSize(this.dbs);
    this.post.resize(this.dbs.x, this.dbs.y, pr);
    onPixelRatio?.(pr);
  }

  public render(): void {
    this.post.render();
  }
}

export { clamp };
