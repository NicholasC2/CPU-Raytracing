const canvas = document.querySelector("canvas");

if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Canvas not found");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
    throw new Error("No 2D context");
}

/* =========================
   MATH
========================= */

class Vector3 {
    constructor(
        public x: number,
        public y: number,
        public z: number
    ) {}

    add(v: Vector3) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v: Vector3) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
    mul(s: number) { return new Vector3(this.x * s, this.y * s, this.z * s); }

    dot(v: Vector3) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v: Vector3) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    length() {
        return Math.sqrt(this.dot(this));
    }

    normalize() {
        const l = this.length() || 1;
        return this.mul(1 / l);
    }
}

/* =========================
   CAMERA
========================= */

const camera = {
    position: new Vector3(0, 0, -6),
    yaw: 0,
    pitch: 0
};

/* =========================
   INPUT
========================= */

const keys = new Set<string>();

window.addEventListener("keydown", e => keys.add(e.code));
window.addEventListener("keyup", e => keys.delete(e.code));

canvas.addEventListener("click", () => canvas.requestPointerLock());

document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== canvas) return;

    const sens = 0.002;

    camera.yaw += e.movementX * sens;
    camera.pitch -= e.movementY * sens;

    const limit = Math.PI / 2 - 0.01;
    camera.pitch = Math.max(-limit, Math.min(limit, camera.pitch));
});

/* =========================
   MATERIAL
========================= */

class Material {
    constructor(
        public color: Vector3,
        public roughness: number = 1,
        public reflectivity: number = 0
    ) {}
}

/* =========================
   OBJECTS
========================= */

class Triangle {
    constructor(
        public a: Vector3,
        public b: Vector3,
        public c: Vector3,
        public material: Material
    ) {}
}

class Plane {
    constructor(
        public y: number,
        public material: Material
    ) {}
}

/* =========================
   SCENE
========================= */

const ground = new Plane(
    -2,
    new Material(new Vector3(200, 200, 200), 0.3, 0.7) // 70% smooth
);

const red = new Material(new Vector3(255, 80, 80), 0.8, 0.2);
const blue = new Material(new Vector3(80, 120, 255), 0.5, 0.4);

const triangles: Triangle[] = [];

// stress test objects
for (let i = 0; i < 25; i++) {
    const x = (Math.random() - 0.5) * 10;
    const z = 3 + Math.random() * 20;

    const mat = new Material(
        new Vector3(
            Math.random() * 255,
            Math.random() * 255,
            Math.random() * 255
        ),
        Math.random(),
        Math.random() * 0.5
    );

    triangles.push(
        new Triangle(
            new Vector3(x - 0.5, -2, z),
            new Vector3(x + 0.5, -2, z),
            new Vector3(x, 0.8, z),
            mat
        )
    );
}

/* =========================
   LIGHTS
========================= */

const lights = [
    new Vector3(5, 5, -2),
    new Vector3(-5, 6, -3),
    new Vector3(0, 8, 5),
    new Vector3(4, 3, 3)
];

/* =========================
   MOVEMENT
========================= */

function updateCamera(dt: number) {
    const speed = 5 * dt;

    const forward = new Vector3(
        Math.sin(camera.yaw),
        0,
        Math.cos(camera.yaw)
    );

    const right = new Vector3(
        Math.cos(camera.yaw),
        0,
        -Math.sin(camera.yaw)
    );

    if (keys.has("KeyW")) camera.position = camera.position.add(forward.mul(speed));
    if (keys.has("KeyS")) camera.position = camera.position.sub(forward.mul(speed));
    if (keys.has("KeyD")) camera.position = camera.position.add(right.mul(speed));
    if (keys.has("KeyA")) camera.position = camera.position.sub(right.mul(speed));

    if (keys.has("Space")) camera.position.y += speed;
    if (keys.has("ShiftLeft")) camera.position.y -= speed;
}

/* =========================
   RAY TRACING
========================= */

interface Hit {
    t: number;
    point: Vector3;
    normal: Vector3;
    material: Material;
}

function intersectTriangle(ro: Vector3, rd: Vector3, tri: Triangle): Hit | null {
    const EPS = 0.000001;

    const edge1 = tri.b.sub(tri.a);
    const edge2 = tri.c.sub(tri.a);

    const h = rd.cross(edge2);
    const a = edge1.dot(h);

    if (Math.abs(a) < EPS) return null;

    const f = 1 / a;
    const s = ro.sub(tri.a);

    const u = f * s.dot(h);
    if (u < 0 || u > 1) return null;

    const q = s.cross(edge1);

    const v = f * rd.dot(q);
    if (v < 0 || u + v > 1) return null;

    const t = f * edge2.dot(q);
    if (t <= EPS) return null;

    return {
        t,
        point: ro.add(rd.mul(t)),
        normal: edge1.cross(edge2).normalize(),
        material: tri.material
    };
}

function intersectPlane(ro: Vector3, rd: Vector3, plane: Plane): Hit | null {
    if (Math.abs(rd.y) < 0.0001) return null;

    const t = (plane.y - ro.y) / rd.y;
    if (t <= 0) return null;

    const point = ro.add(rd.mul(t));

    return {
        t,
        point,
        normal: new Vector3(0, 1, 0),
        material: plane.material
    };
}

function trace(ro: Vector3, rd: Vector3): Hit | null {
    let closest: Hit | null = null;

    for (const tri of triangles) {
        const hit = intersectTriangle(ro, rd, tri);
        if (!hit) continue;
        if (!closest || hit.t < closest.t) closest = hit;
    }

    const planeHit = intersectPlane(ro, rd, ground);
    if (planeHit && (!closest || planeHit.t < closest.t)) {
        closest = planeHit;
    }

    return closest;
}

/* =========================
   CAMERA RAY
========================= */

function getRayDirection(x: number, y: number) {
    const cy = Math.cos(camera.yaw);
    const sy = Math.sin(camera.yaw);

    const cp = Math.cos(camera.pitch);
    const sp = Math.sin(camera.pitch);

    const forward = new Vector3(cp * sy, sp, cp * cy);
    const right = new Vector3(cy, 0, -sy);
    const up = forward.cross(right).normalize();

    return forward
        .add(right.mul(x))
        .add(up.mul(y))
        .normalize();
}

/* =========================
   LIGHTING
========================= */

function reflect(dir: Vector3, n: Vector3) {
    return dir.sub(n.mul(2 * dir.dot(n)));
}

/* =========================
   RENDER
========================= */

let last = performance.now();

function render() {
    if(!ctx) return;
    if(!canvas) return;

    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    updateCamera(dt);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const image = ctx.createImageData(canvas.width, canvas.height);
    const data = image.data;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {

            const nx = (x / canvas.width) * 2 - 1;
            const ny = 1 - (y / canvas.height) * 2;

            const rd = getRayDirection(nx, ny);

            const hit = trace(camera.position, rd);

            const i = (y * canvas.width + x) * 4;

            if (!hit) {
                data[i + 0] = 15;
                data[i + 1] = 15;
                data[i + 2] = 25;
                data[i + 3] = 255;
                continue;
            }

            let light = 0;

            for (const l of lights) {
                const toL = l.sub(hit.point).normalize();

                const shadow = trace(hit.point.add(hit.normal.mul(0.001)), toL);
                if (shadow) continue;

                light += Math.max(0, hit.normal.dot(toL));
            }

            light = Math.min(1, light / lights.length);

            const reflDir = reflect(rd, hit.normal);
            const refl = trace(hit.point.add(hit.normal.mul(0.001)), reflDir);

            let reflection = new Vector3(0, 0, 0);

            if (refl) {
                reflection = refl.material.color.mul(0.5);
            }

            const col = hit.material.color;

            const final = col.mul(0.7 * light)
                .add(reflection.mul(hit.material.reflectivity));

            data[i + 0] = final.x;
            data[i + 1] = final.y;
            data[i + 2] = final.z;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(image, 0, 0);

    requestAnimationFrame(render);
}

render();