const canvas = document.getElementById("gameCanvas");
canvas.tabIndex = 1;
canvas.style.cursor = "crosshair";

const engine = new BABYLON.Engine(canvas, true);

window.addEventListener("resize", () => engine.resize());

// Main menu buttons
const menu = document.getElementById("mainMenu");
const practiceBtn = document.getElementById("practiceBtn");
const startOnlineBtn = document.getElementById("startOnline");

practiceBtn.addEventListener("click", () => {
    menu.style.display = "none";
    startPracticeArena();
});

startOnlineBtn.addEventListener("click", () => {
    alert("Online mode not implemented yet!");
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

    // Walls & crates
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

    // Player health, kills, game over
    let playerHealth = 200;
    let kills = 0;
    let gameOver = false;
    let gameOverUI = null;

    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Pause system
    let isPaused = false;
    let pauseOverlay = null;
    function setPause(pause) {
        isPaused = pause;
        if (isPaused) {
            if (document.pointerLockElement === canvas) document.exitPointerLock();
            if (!pauseOverlay) {
                pauseOverlay = new BABYLON.GUI.Rectangle();
                pauseOverlay.width = "400px";
                pauseOverlay.height = "300px";
                pauseOverlay.cornerRadius = 20;
                pauseOverlay.background = "rgba(0,0,0,0.7)";
                pauseOverlay.thickness = 0;
                pauseOverlay.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                pauseOverlay.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
                advancedTexture.addControl(pauseOverlay);

                const pausedText = new BABYLON.GUI.TextBlock();
                pausedText.text = "PAUSED";
                pausedText.color = "white";
                pausedText.fontSize = 36;
                pausedText.top = "-100px";
                pauseOverlay.addControl(pausedText);

                const resumeBtn = BABYLON.GUI.Button.CreateSimpleButton("resumeBtn", "Resume");
                resumeBtn.width = "180px";
                resumeBtn.height = "50px";
                resumeBtn.color = "white";
                resumeBtn.background = "gray";
                resumeBtn.top = "-20px";
                resumeBtn.onPointerUpObservable.add(() => { setPause(false); });
                pauseOverlay.addControl(resumeBtn);

                const menuBtn = BABYLON.GUI.Button.CreateSimpleButton("menuBtn", "Main Menu");
                menuBtn.width = "180px";
                menuBtn.height = "50px";
                menuBtn.color = "white";
                menuBtn.background = "gray";
                menuBtn.top = "60px";
                menuBtn.onPointerUpObservable.add(() => {
                    advancedTexture.removeControl(pauseOverlay);
                    pauseOverlay = null;
                    menu.style.display = "block";
                });
                pauseOverlay.addControl(menuBtn);
            }
        } else {
            if (pauseOverlay) {
                advancedTexture.removeControl(pauseOverlay);
                pauseOverlay = null;
            }
            if (!gameOver) canvas.requestPointerLock();
        }
    }

    // Camera setup
    const camOffsetX = 1;
    const camera = new BABYLON.UniversalCamera("thirdPersonCam", player.position.add(new BABYLON.Vector3(0, 3, -6)), scene);
    camera.attachControl(canvas, true);
    camera.checkCollisions = true;
    camera.applyGravity = true;
    camera.inertia = 0.2;
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];

    let yaw = 0, pitch = 0, locked = false;

    canvas.addEventListener("click", () => {
        if (!locked && !isPaused && !gameOver) canvas.requestPointerLock();
        else if (!gameOver && !isPaused) shootBullet();
    });

    document.addEventListener("pointerlockchange", () => {
        locked = (document.pointerLockElement === canvas && !isPaused);
        if (!locked && !isPaused && !gameOver) setPause(true);
    });

    // Mouse look
    document.addEventListener("mousemove", e => {
        if (!locked || isPaused) return;
        const sensitivity = 0.002;
        yaw += e.movementX * sensitivity;
        pitch += e.movementY * sensitivity;
        pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
    });

    // Input
    const input = { w: false, a: false, s: false, d: false };
    window.addEventListener("keydown", e => { if (!isPaused && e.key in input) input[e.key] = true; });
    window.addEventListener("keyup", e => { if (e.key in input) input[e.key] = false; });

    // AI
    const aiEnemies = [], maxEnemies = 5, aiSpeed = 0.1;
    function spawnAI() {
        let x, z, valid;
        do {
            x = Math.random() * 180 - 90;
            z = Math.random() * 180 - 90;
            const pos = new BABYLON.Vector3(x, 1, z);
            const dist = BABYLON.Vector3.Distance(pos, player.position);
            const collidingWall = walls.some(w => {
                const min = w.getBoundingInfo().boundingBox.minimumWorld;
                const max = w.getBoundingInfo().boundingBox.maximumWorld;
                return (pos.x > min.x && pos.x < max.x && pos.z > min.z && pos.z < max.z);
            });
            valid = dist > 10 && !collidingWall;
        } while (!valid);

        const ai = BABYLON.MeshBuilder.CreateBox("ai", { width: 1, height: 2, depth: 1 }, scene);
        ai.position = new BABYLON.Vector3(x, 1, z);
        ai.material = new BABYLON.StandardMaterial("aiMat", scene);
        ai.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        ai.checkCollisions = true;
        ai.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        ai.health = 50;
        ai.lastDamageTime = 0;
        ai.suicide = false;
        aiEnemies.push(ai);
    }
    for (let i = 0; i < maxEnemies; i++) spawnAI();

    function updateAI() {
        if (isPaused || gameOver) return;
        const now = performance.now();
        aiEnemies.slice().forEach(ai => {
            const dir = player.position.subtract(ai.position);
            dir.y = 0;
            if (dir.length() > 0) dir.normalize();
            ai.moveWithCollisions(dir.scale(aiSpeed));

            const aiBox = ai.getBoundingInfo().boundingBox;
            const playerBox = player.getBoundingInfo().boundingBox;

            if (!gameOver && now - ai.lastDamageTime > 200) {
                const collision =
                    aiBox.minimumWorld.x <= playerBox.maximumWorld.x &&
                    aiBox.maximumWorld.x >= playerBox.minimumWorld.x &&
                    aiBox.minimumWorld.y <= playerBox.maximumWorld.y &&
                    aiBox.maximumWorld.y >= playerBox.minimumWorld.y &&
                    aiBox.minimumWorld.z <= playerBox.maximumWorld.z &&
                    aiBox.maximumWorld.z >= playerBox.minimumWorld.z;
                if (collision) {
                    playerHealth -= 20;
                    ai.lastDamageTime = now;
                    ai.health = 0;
                    ai.suicide = true;
                    if (playerHealth <= 0) { showGameOver(); player.isVisible = false; }
                }
            }

            if (ai.health <= 0) {
                ai.dispose();
                aiEnemies.splice(aiEnemies.indexOf(ai), 1);
                spawnAI();
                if (!ai.suicide) kills += 1;
            }
        });
    }

    // UI
    const healthBG = new BABYLON.GUI.Rectangle();
    healthBG.width = "300px";
    healthBG.height = "30px";
    healthBG.cornerRadius = 5;
    healthBG.color = "white";
    healthBG.thickness = 2;
    healthBG.background = "black";
    healthBG.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBG.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    healthBG.left = "20px";
    healthBG.top = "20px";
    advancedTexture.addControl(healthBG);

    const healthBar = new BABYLON.GUI.Rectangle();
    healthBar.height = "100%";
    healthBar.cornerRadius = 5;
    healthBar.background = "green";
    healthBar.thickness = 0;
    healthBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBar.left = "0px";
    healthBG.addControl(healthBar);

    const killBG = new BABYLON.GUI.Rectangle();
    killBG.width = "150px";
    killBG.height = "30px";
    killBG.cornerRadius = 5;
    killBG.color = "white";
    killBG.thickness = 2;
    killBG.background = "black";
    killBG.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    killBG.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    killBG.left = "20px";
    killBG.top = "60px";
    advancedTexture.addControl(killBG);

    const killText = new BABYLON.GUI.TextBlock();
    killText.text = "Kills: 0";
    killText.color = "yellow";
    killText.fontSize = 20;
    killText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    killText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    killBG.addControl(killText);

    function updateHealthBar() { healthBar.width = `${Math.max(playerHealth / 200, 0) * 100}%`; }
    function updateKillCounter() { killText.text = `Kills: ${kills}`; }

    function showGameOver() {
        if (gameOverUI) return;
        gameOver = true;
        player.isVisible = false;

        gameOverUI = new BABYLON.GUI.Rectangle();
        gameOverUI.width = "400px";
        gameOverUI.height = "200px";
        gameOverUI.cornerRadius = 20;
        gameOverUI.background = "rgba(0,0,0,0.7)";
        gameOverUI.thickness = 0;
        gameOverUI.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        gameOverUI.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        advancedTexture.addControl(gameOverUI);

        const goText = new BABYLON.GUI.TextBlock();
        goText.text = "YOU DIED";
        goText.color = "white";
        goText.fontSize = 36;
        goText.top = "-40px";
        gameOverUI.addControl(goText);

        const backBtn = new BABYLON.GUI.Button.CreateSimpleButton("back", "Back");
        backBtn.width = "120px";
        backBtn.height = "50px";
        backBtn.color = "white";
        backBtn.background = "gray";
        backBtn.top = "40px";
        backBtn.onPointerUpObservable.add(() => {
            advancedTexture.removeControl(gameOverUI);
            gameOverUI = null;
            startPracticeArena();
        });
        gameOverUI.addControl(backBtn);

        if (document.pointerLockElement === canvas) document.exitPointerLock();
    }

    // Shooting function
    function shootBullet() {
        if (gameOver || isPaused) return;

        const gunOffset = new BABYLON.Vector3(0.6, 0.3, 0.5);
        const gunWorldOffset = BABYLON.Vector3.TransformCoordinates(
            gunOffset,
            BABYLON.Matrix.RotationYawPitchRoll(yaw, 0, 0)
        );
        const bulletStart = player.position.add(gunWorldOffset);

        const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: 0.3 }, scene);
        bullet.position = bulletStart;
        const mat = new BABYLON.StandardMaterial("bmat", scene);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 0);
        bullet.material = mat;

        const screenCenter = new BABYLON.Vector2(canvas.width / 2, canvas.height / 2);
        const pickInfo = scene.pick(screenCenter.x, screenCenter.y, mesh => true, false, camera);
        let targetPos = pickInfo.hit
            ? pickInfo.pickedPoint
            : bullet.position.add(camera.getForwardRay().direction.scale(100));

        let direction = targetPos.subtract(bullet.position);
        direction.y += 0.8;
        direction = direction.normalize();

        const speed = 2;
        let life = 0;

        const moveBullet = () => {
            if (!bullet || bullet.isDisposed() || isPaused) return;

            const ray = new BABYLON.Ray(bullet.position, direction, speed);
            const hitWall = scene.pickWithRay(ray, mesh => walls.includes(mesh));
            if (hitWall.hit) {
                bullet.dispose();
                scene.unregisterBeforeRender(moveBullet);
                return;
            }

            const hitAI = scene.pickWithRay(ray, mesh => aiEnemies.includes(mesh));
            if (hitAI.hit) {
                const target = hitAI.pickedMesh;
                target.health -= 20;
                if (target.health <= 0) {
                    if (!target.suicide) kills += 1;
                    target.dispose();
                    aiEnemies.splice(aiEnemies.indexOf(target), 1);
                    spawnAI();
                }
                bullet.dispose();
                scene.unregisterBeforeRender(moveBullet);
                return;
            }

            bullet.position.addInPlace(direction.scale(speed));
            life += engine.getDeltaTime();
            if (life > 5000) {
                bullet.dispose();
                scene.unregisterBeforeRender(moveBullet);
            }
        };

        scene.registerBeforeRender(moveBullet);
    }

    // ESC pause
    window.addEventListener("keydown", e => {
        if (e.key === "Escape" && !gameOver) setPause(!isPaused);
    });

    // Render loop
    engine.runRenderLoop(() => {
        if (playerHealth <= 0 && !gameOver) {
            gameOver = true;
            player.isVisible = false;
            showGameOver();
        }

        updateHealthBar();
        updateKillCounter();

        if (!isPaused && !gameOver) {
            const speed = 0.1;
            const fwd = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
            const right = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            let move = new BABYLON.Vector3(0, 0, 0);
            if (input.w) move.addInPlace(fwd);
            if (input.s) move.addInPlace(fwd.scale(-1));
            if (input.a) move.addInPlace(right.scale(-1));
            if (input.d) move.addInPlace(right);
            if (move.length() > 0) move.normalize();
            player.moveWithCollisions(move.scale(speed));
            player.rotation.y = yaw;

            const camDist = 8, camHeight = 2;
            const desiredPos = player.position
                .add(new BABYLON.Vector3(-Math.sin(yaw) * camDist, camHeight, -Math.cos(yaw) * camDist))
                .add(new BABYLON.Vector3(Math.cos(yaw) * camOffsetX, 0, -Math.sin(yaw) * camOffsetX));
            camera.position = BABYLON.Vector3.Lerp(camera.position, desiredPos, 0.1);

            camera.rotation.y = yaw;
            camera.rotation.x = pitch;

            updateAI();
        }

        scene.render();
    });
}
