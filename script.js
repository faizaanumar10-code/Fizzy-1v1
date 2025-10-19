const canvas = document.getElementById("gameCanvas");
const engine = new BABYLON.Engine(canvas, true);
window.addEventListener("resize", () => engine.resize());

const menu = document.getElementById("mainMenu");
const practiceBtn = document.getElementById("practiceBtn");

practiceBtn.addEventListener("click", () => {
    menu.style.display = "none"; // hide menu
    startPracticeArena();
});

function startPracticeArena() {
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 20, 0), scene);

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
    ground.checkCollisions = true;
    ground.material = new BABYLON.StandardMaterial("groundMat", scene);
    ground.material.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.2);

    // Arena walls and crates
    const walls = [];

    function createWall(x, z, w, h, d, color) {
        const wall = BABYLON.MeshBuilder.CreateBox("wall", { width: w, height: h, depth: d }, scene);
        wall.position = new BABYLON.Vector3(x, h / 2, z);
        wall.checkCollisions = true;
        wall.material = new BABYLON.StandardMaterial("wallMat", scene);
        wall.material.diffuseColor = color || new BABYLON.Color3(0.5, 0.5, 0.5);
        walls.push(wall);
    }

    function createCrate(x, z, size, height, color) {
        const crate = BABYLON.MeshBuilder.CreateBox("crate", { width: size, height: height, depth: size }, scene);
        crate.position = new BABYLON.Vector3(x, height / 2, z);
        crate.checkCollisions = true;
        crate.material = new BABYLON.StandardMaterial("crateMat", scene);
        crate.material.diffuseColor = color || new BABYLON.Color3(0.7, 0.5, 0.2);
        walls.push(crate);
    }

    // Outer walls
    createWall(100, 0, 2, 10, 200);
    createWall(-100, 0, 2, 10, 200);
    createWall(0, 100, 200, 10, 2);
    createWall(0, -100, 200, 10, 2);

    // Inner walls & crates
    createWall(0, 0, 40, 10, 2, new BABYLON.Color3(0.6, 0.3, 0.2));
    createWall(-50, 50, 30, 10, 2, new BABYLON.Color3(0.6, 0.6, 0.6));
    createWall(50, -50, 30, 10, 2, new BABYLON.Color3(0.3, 0.3, 0.7));
    createWall(0, 50, 2, 10, 40, new BABYLON.Color3(0.7, 0.3, 0.3));

    createCrate(-30, -30, 5, 5, new BABYLON.Color3(0.8, 0.2, 0.2));
    createCrate(30, 30, 5, 5, new BABYLON.Color3(0.2, 0.2, 0.8));
    createCrate(0, -40, 10, 3, new BABYLON.Color3(0.5, 0.5, 0.2));
    createCrate(40, 0, 3, 6, new BABYLON.Color3(0.3, 0.7, 0.3));

    // Player
    const player = BABYLON.MeshBuilder.CreateBox("player", { width: 1, height: 2, depth: 1 }, scene);
    player.position = new BABYLON.Vector3(0, 1, -80);
    player.checkCollisions = true;
    player.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    player.isVisible = false;

    // Camera (not parented)
    const camera = new BABYLON.UniversalCamera("cam", player.position.add(new BABYLON.Vector3(0,1,0)), scene);
    camera.attachControl(canvas, true);
    camera.checkCollisions = true;
    camera.applyGravity = true;

    // Pointer lock & shooting
    let locked = false;
    canvas.addEventListener("click", () => {
        if (!locked) canvas.requestPointerLock();
        else shootBullet();
    });
    document.addEventListener("pointerlockchange", () => { locked = (document.pointerLockElement === canvas); });

function shootBullet() {
    const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: 0.3 }, scene);
    const mat = new BABYLON.StandardMaterial("bmat", scene);
    mat.emissiveColor = new BABYLON.Color3(1, 1, 0);
    bullet.material = mat;

    const forward = camera.getForwardRay().direction.normalize();
    bullet.position = camera.position.add(forward.scale(2)).add(new BABYLON.Vector3(0, 0.5, 0));

    const speed = 2;
    let life = 0;

    const moveBullet = () => {
        if (!bullet || bullet.isDisposed()) return;

        // Perform a raycast from current position forward
        const ray = new BABYLON.Ray(bullet.position, forward, speed);
        const hit = scene.pickWithRay(ray, (mesh) => walls.includes(mesh));

        if (hit.hit) {
            bullet.dispose();
            scene.unregisterBeforeRender(moveBullet);
            return;
        }

        bullet.position.addInPlace(forward.scale(speed));

        life += engine.getDeltaTime();
        if (life > 5000) {
            bullet.dispose();
            scene.unregisterBeforeRender(moveBullet);
        }
    };

    scene.registerBeforeRender(moveBullet);
}


    // Movement WASD
    const input = { w: false, a: false, s: false, d: false };
    window.addEventListener("keydown", e => { if (e.key in input) input[e.key] = true; });
    window.addEventListener("keyup", e => { if (e.key in input) input[e.key] = false; });

    engine.runRenderLoop(() => {
        const speed = 0.1;
        const fwd = camera.getDirection(BABYLON.Axis.Z).clone(); fwd.y = 0;
        const right = camera.getDirection(BABYLON.Axis.X).clone(); right.y = 0;

        let move = new BABYLON.Vector3(0, 0, 0);
        if (input.w) move.addInPlace(fwd);
        if (input.s) move.addInPlace(fwd.scale(-1));
        if (input.a) move.addInPlace(right.scale(-1));
        if (input.d) move.addInPlace(right);

        if (move.length() > 0) {
            move.normalize();
            player.moveWithCollisions(move.scale(speed));
            camera.position = player.position.add(new BABYLON.Vector3(0, 1, 0));
        }

        scene.render();
    });
}
