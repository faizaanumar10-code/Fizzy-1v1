const canvas = document.getElementById("gameCanvas");
canvas.tabIndex = 1;
canvas.style.cursor = "crosshair";
const engine = new BABYLON.Engine(canvas, true);

window.addEventListener("resize", () => engine.resize());

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

    // Walls & Crates
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

    let playerHealth = 200;
    let kills = 0;
    const startTime = Date.now();
    let gameOver = false;

    // Camera
    const camera = new BABYLON.UniversalCamera("cam", player.position.add(new BABYLON.Vector3(0, 1, 0)), scene);
    camera.attachControl(canvas, true);
    camera.checkCollisions = true;
    camera.applyGravity = true;
    camera.inertia = 0.2;
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];

    // Pointer lock & shooting
    let locked = false;
    canvas.addEventListener("click", () => {
        if (!locked) canvas.requestPointerLock();
        else if(!gameOver) shootBullet();
    });
    document.addEventListener("pointerlockchange", () => { locked = (document.pointerLockElement === canvas); });
    document.addEventListener("pointerlockerror", () => console.error("Pointer lock failed"));

    // Mouse look
    let yaw = 0, pitch = 0;
    document.addEventListener("mousemove", e => {
        if (!locked || gameOver) return;
        const sensitivity = 0.002;
        yaw += e.movementX * sensitivity;
        pitch += e.movementY * sensitivity;
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
        camera.rotation = new BABYLON.Vector3(pitch, yaw, 0);
    });

    // WASD Movement
    const input = { w:false, a:false, s:false, d:false };
    window.addEventListener("keydown", e => { if(e.key in input) input[e.key]=true; });
    window.addEventListener("keyup", e => { if(e.key in input) input[e.key]=false; });

    // AI Setup
    const aiEnemies = [];
    const maxEnemies = 5;
    const aiSpeed = 0.1;

    function spawnAI() {
        let x, z, valid;
        do {
            x = Math.random() * 180 - 90;
            z = Math.random() * 180 - 90;
            const pos = new BABYLON.Vector3(x,1,z);
            const dist = BABYLON.Vector3.Distance(pos, player.position);
            const collidingWall = walls.some(w => {
                const min = w.getBoundingInfo().boundingBox.minimumWorld;
                const max = w.getBoundingInfo().boundingBox.maximumWorld;
                return (pos.x > min.x && pos.x < max.x && pos.z > min.z && pos.z < max.z);
            });
            valid = dist > 10 && !collidingWall;
        } while (!valid);

        const ai = BABYLON.MeshBuilder.CreateBox("ai", {width:1, height:2, depth:1}, scene);
        ai.position = new BABYLON.Vector3(x,1,z);
        ai.material = new BABYLON.StandardMaterial("aiMat", scene);
        ai.material.diffuseColor = new BABYLON.Color3(1,0,0);
        ai.checkCollisions = true;
        ai.ellipsoid = new BABYLON.Vector3(0.5,1,0.5);
        ai.health = 50;
        ai.lastDamageTime = 0;
        aiEnemies.push(ai);
    }

    for(let i=0;i<maxEnemies;i++) spawnAI();

    function updateAI() {
        if(gameOver) return;
        const now = performance.now();
        aiEnemies.slice().forEach(ai => {
            const dir = player.position.subtract(ai.position);
            dir.y = 0;
            if(dir.length() > 0) dir.normalize();
            ai.moveWithCollisions(dir.scale(aiSpeed)); // FIXED speed here

            const aiBox = ai.getBoundingInfo().boundingBox;
            const playerBox = player.getBoundingInfo().boundingBox;

            if(now - ai.lastDamageTime > 200) {
                const collision =
                    aiBox.minimumWorld.x <= playerBox.maximumWorld.x &&
                    aiBox.maximumWorld.x >= playerBox.minimumWorld.x &&
                    aiBox.minimumWorld.y <= playerBox.maximumWorld.y &&
                    aiBox.maximumWorld.y >= playerBox.minimumWorld.y &&
                    aiBox.minimumWorld.z <= playerBox.maximumWorld.z &&
                    aiBox.maximumWorld.z >= playerBox.minimumWorld.z;

                if(collision) {
                    playerHealth -= 20;
                    ai.lastDamageTime = now;
                    ai.health = 0; // AI dies
                }
            }

            if(ai.health <= 0) {
                ai.dispose();
                aiEnemies.splice(aiEnemies.indexOf(ai),1);
                spawnAI();
            }
        });
    }

    // GUI
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const healthBG = new BABYLON.GUI.Rectangle();
    healthBG.width = "300px"; healthBG.height = "30px"; healthBG.cornerRadius = 5;
    healthBG.color = "white"; healthBG.thickness = 2; healthBG.background = "black";
    healthBG.horizontalAlignment=BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBG.verticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    healthBG.left = "20px"; healthBG.top = "20px"; advancedTexture.addControl(healthBG);

    const healthBar = new BABYLON.GUI.Rectangle();
    healthBar.width = "100%"; healthBar.height = "100%"; healthBar.cornerRadius = 5;
    healthBar.background = "green"; healthBar.thickness = 0;
    healthBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBG.addControl(healthBar);

    const statsText = new BABYLON.GUI.TextBlock();
    statsText.color="white"; statsText.fontSize=20;
    statsText.text=`Kills: ${kills} | Time: 0s`;
    statsText.top = "60px"; statsText.left = "20px";
    statsText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    statsText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    advancedTexture.addControl(statsText);

    let displayedHealth = playerHealth;
    function updateHealthBar() {
        displayedHealth += (playerHealth - displayedHealth) * 0.1;
        const healthPercent = Math.max(displayedHealth / 200, 0);
        healthBar.width = `${healthPercent * 100}%`;
    }

    // Game Over
    let gameOverUI = null;
    function showGameOver() {
        gameOver = true;
        gameOverUI = new BABYLON.GUI.Rectangle();
        gameOverUI.width="400px"; gameOverUI.height="200px"; gameOverUI.cornerRadius=20;
        gameOverUI.background="rgba(0,0,0,0.7)"; gameOverUI.thickness=0;
        gameOverUI.horizontalAlignment=BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        gameOverUI.verticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        advancedTexture.addControl(gameOverUI);

        const goText = new BABYLON.GUI.TextBlock();
        goText.text="GAME OVER"; goText.color="white"; goText.fontSize=36; goText.top="-40px";
        gameOverUI.addControl(goText);

        const backBtn = new BABYLON.GUI.Button.CreateSimpleButton("back","Back");
        backBtn.width="120px"; backBtn.height="50px"; backBtn.color="white"; backBtn.background="gray"; backBtn.top="40px";
        backBtn.onPointerUpObservable.add(()=> {
            advancedTexture.removeControl(gameOverUI);
            menu.style.display="flex"; 
        });
        gameOverUI.addControl(backBtn);
    }

    // Shooting
    function shootBullet() {
        const bullet = BABYLON.MeshBuilder.CreateSphere("bullet", { diameter: 0.3 }, scene);
        bullet.position = camera.position.add(camera.getForwardRay().direction.normalize().scale(2)).add(new BABYLON.Vector3(0,0.5,0));
        const mat = new BABYLON.StandardMaterial("bmat", scene); mat.emissiveColor = new BABYLON.Color3(1,1,0);
        bullet.material = mat;
        const forward = camera.getForwardRay().direction.normalize();
        const speed = 2;
        let life = 0;

        const moveBullet = () => {
            if (!bullet || bullet.isDisposed()) return;
            const ray = new BABYLON.Ray(bullet.position, forward, speed);
            const hitWall = scene.pickWithRay(ray, mesh => walls.includes(mesh));
            if(hitWall.hit) { bullet.dispose(); scene.unregisterBeforeRender(moveBullet); return; }

            const hitAI = scene.pickWithRay(ray, mesh => aiEnemies.includes(mesh));
            if(hitAI.hit) {
                const target = hitAI.pickedMesh;
                target.health -= 20;
                if(target.health <=0) {
                    kills += 1;
                    target.dispose();
                    aiEnemies.splice(aiEnemies.indexOf(target),1);
                    spawnAI();
                }
                bullet.dispose(); scene.unregisterBeforeRender(moveBullet); return;
            }

            bullet.position.addInPlace(forward.scale(speed));
            life += engine.getDeltaTime();
            if(life>5000) { bullet.dispose(); scene.unregisterBeforeRender(moveBullet); }
        };
        scene.registerBeforeRender(moveBullet);
    }

    // Main Loop
    engine.runRenderLoop(()=> {
        if(gameOver) return;

        const speed = 0.1;
        const fwd = camera.getDirection(BABYLON.Axis.Z).clone(); fwd.y=0;
        const right = camera.getDirection(BABYLON.Axis.X).clone(); right.y=0;
        let move = new BABYLON.Vector3(0,0,0);
        if(input.w) move.addInPlace(fwd);
        if(input.s) move.addInPlace(fwd.scale(-1));
        if(input.a) move.addInPlace(right.scale(-1));
        if(input.d) move.addInPlace(right);
        if(move.length()>0){
            move.normalize();
            player.moveWithCollisions(move.scale(speed));
            camera.position = player.position.add(new BABYLON.Vector3(0,1,0));
        }

        updateAI();
        updateHealthBar();
        statsText.text = `Kills: ${kills} | Time: ${Math.floor((Date.now()-startTime)/1000)}s`;

        if(playerHealth <= 0 && !gameOverUI) showGameOver();
        scene.render();
    });
}
