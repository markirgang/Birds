/**
 * Animatronic Bird Show Visualizer Engine (Three.js 3D & Interactive 2D Canvas Fallback)
 * Visualizes:
 * - 2 Rear Tall Parrots on 3-DOF Servo Perches (Turn, Bow, Shimmy)
 * - L298 Channel A: Mouth Opening (Normal Polarity) & Blinking Eyes (Reverse Polarity)
 * - L298 Channel B: Flapping Wings
 * - 2-DOF Spotlight Servo Bases (Pan, Tilt + Light Cones)
 * - Center Small Bird with Motor Motion, Chirping Mouth & Stationary Spotlight
 * - Left & Right Small Birds with Relay Chirp Visualizers & Spotlights
 * - Main Stage Rotating Servo Base
 */

class BirdShow3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.minHeight = '480px';

        // Local state references for animation
        this.state = {
            ai_sync_mode: "turns",
            active_speaker: "parrot1",
            is_speaking: false,
            main_base: { servo_angle: 90 },
            parrot1: {
                mouth_eyes_channel_a: "off",
                wings_channel_b: false,
                perch: { turn: 90, bow: 90, shimmy: 90 },
                spotlight: { pan: 90, tilt: 90, intensity: 100 },
                voice: "ai_female_us"
            },
            parrot2: {
                mouth_eyes_channel_a: "off",
                wings_channel_b: false,
                perch: { turn: 90, bow: 90, shimmy: 90 },
                spotlight: { pan: 90, tilt: 90, intensity: 100 },
                voice: "ai_male_us"
            },
            center_bird: { motor_moving: false, mouth_chirp: false, perch: { turn: 90, bow: 90, shimmy: 90 } },
            front_left_bird: { spotlight: true, moving: false, relay_chirp: false },
            front_right_bird: { spotlight: true, moving: false, relay_chirp: false },
            rear_left_bird: { spotlight: true, moving: false },
            rear_right_bird: { spotlight: true, moving: false }
        };

        this.webglSupported = false;

        try {
            if (typeof THREE === 'undefined') {
                throw new Error("Three.js library is not loaded");
            }

            const width = this.container.clientWidth || 800;
            const height = this.container.clientHeight || 480;

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x0c0f1d);

            this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
            this.camera.position.set(0, 240, 480);

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
            this.renderer.setSize(width, height, false);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

            try {
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            } catch (shadowErr) {
                console.warn("Shadow maps disabled for WebGL compatibility:", shadowErr);
                this.renderer.shadowMap.enabled = false;
            }

            const canvas = this.renderer.domElement;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';
            this.container.appendChild(canvas);

            if (typeof THREE.OrbitControls === 'function') {
                this.controls = new THREE.OrbitControls(this.camera, canvas);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
                this.controls.target.set(0, 100, 0);
            } else {
                this.controls = { update: () => {} };
            }

            this.clock = new THREE.Clock();
            this.initLighting();
            this.buildStage();

            this.webglSupported = true;
            window.addEventListener('resize', () => this.onWindowResize());
            this.animate();

        } catch (err) {
            console.warn("WebGL initialization failed. Activating 2D Interactive Stage Renderer:", err);
            this.init2DFallback();
        }
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfffaed, 0.8);
        dirLight.position.set(200, 400, 300);
        if (this.renderer.shadowMap.enabled) {
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
        }
        this.scene.add(dirLight);

        const stageLight = new THREE.PointLight(0x00f0ff, 0.5, 600);
        stageLight.position.set(0, 300, 100);
        this.scene.add(stageLight);
    }

    buildStage() {
        // Outer Base Frame
        const outerBaseGeo = new THREE.CylinderGeometry(250, 260, 15, 64);
        const outerBaseMat = new THREE.MeshStandardMaterial({ color: 0x0a0e1a, roughness: 0.8 });
        const outerBaseMesh = new THREE.Mesh(outerBaseGeo, outerBaseMat);
        outerBaseMesh.position.y = -22;
        this.scene.add(outerBaseMesh);

        // Stage Root Group
        this.stageRoot = new THREE.Group();
        this.scene.add(this.stageRoot);

        // 1. Turntable Disc
        const baseGeo = new THREE.CylinderGeometry(225, 230, 18, 64);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d2612, roughness: 0.5, metalness: 0.2 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = -9;
        baseMesh.receiveShadow = true;
        this.stageRoot.add(baseMesh);

        // Radial Wood Planks & Spokes
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.8, roughness: 0.2 });
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 210), spokeMat);
            spoke.rotation.y = angle;
            spoke.position.y = 0.5;
            this.stageRoot.add(spoke);

            const tooth = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 15), spokeMat);
            tooth.position.set(Math.sin(angle) * 225, 0, Math.cos(angle) * 225);
            this.stageRoot.add(tooth);
        }

        // Turntable Hub
        const hubMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(35, 40, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9 })
        );
        hubMesh.position.y = 1;
        this.stageRoot.add(hubMesh);

        // 2. Build 2 Rear Tall Parrots
        this.parrot1Group = this.buildParrot(0xff2222, 0xffd700, 0x0088ff, "Parrot 1 (Left)");
        this.parrot1Group.position.set(-110, 0, -60);
        this.stageRoot.add(this.parrot1Group);

        this.parrot2Group = this.buildParrot(0x00cc44, 0x00d4ff, 0xff8800, "Parrot 2 (Right)");
        this.parrot2Group.position.set(110, 0, -60);
        this.stageRoot.add(this.parrot2Group);

        // 3. Cantilevered Spotlights
        this.spotlight1 = this.buildCantileveredSpotlight(-1, 0xff2244);
        this.scene.add(this.spotlight1.group);

        this.spotlight2 = this.buildCantileveredSpotlight(1, 0x00ff88);
        this.scene.add(this.spotlight2.group);

        // 4. Center Front Small Bird
        this.centerBirdObj = this.buildSmallBird(0xffd700, "center", { hasSpotlight: true, hasRelay: false, hasMotor: true });
        this.centerBirdObj.group.position.set(0, 0, 125);
        this.stageRoot.add(this.centerBirdObj.group);

        // 5. 2 Front Small Birds
        this.frontLeftBirdObj = this.buildSmallBird(0xff00cc, "front_left", { hasSpotlight: true, hasRelay: true, hasMotor: true });
        this.frontLeftBirdObj.group.position.set(-130, 0, 120);
        this.stageRoot.add(this.frontLeftBirdObj.group);

        this.frontRightBirdObj = this.buildSmallBird(0x00e5ff, "front_right", { hasSpotlight: true, hasRelay: true, hasMotor: true });
        this.frontRightBirdObj.group.position.set(130, 0, 120);
        this.stageRoot.add(this.frontRightBirdObj.group);

        // 6. 2 Rear Small Birds
        this.rearLeftBirdObj = this.buildSmallBird(0xaa00ff, "rear_left", { hasSpotlight: true, hasRelay: false, hasMotor: true });
        this.rearLeftBirdObj.group.position.set(-170, 0, 10);
        this.stageRoot.add(this.rearLeftBirdObj.group);

        this.rearRightBirdObj = this.buildSmallBird(0xff7700, "rear_right", { hasSpotlight: true, hasRelay: false, hasMotor: true });
        this.rearRightBirdObj.group.position.set(170, 0, 10);
        this.stageRoot.add(this.rearRightBirdObj.group);

        // 7. Small Computer Screen on Stage
        this.computerScreenObj = this.buildComputerScreen();
        this.computerScreenObj.position.set(38, 0, 160);
        this.computerScreenObj.rotation.y = -0.25;
        this.stageRoot.add(this.computerScreenObj);
    }

    buildComputerScreen() {
        const compGroup = new THREE.Group();

        const baseMat = new THREE.MeshStandardMaterial({ color: 0x111625, metalness: 0.8, roughness: 0.2 });
        const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 4, 32), baseMat);
        baseMesh.position.y = 2;
        compGroup.add(baseMesh);

        const neckMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9, roughness: 0.1 });
        const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 30, 16), neckMat);
        neckMesh.position.set(0, 17, 0);
        compGroup.add(neckMesh);

        const jointMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), baseMat);
        jointMesh.position.set(0, 32, 0);
        compGroup.add(jointMesh);

        const headGroup = new THREE.Group();
        headGroup.position.set(0, 38, 0);
        headGroup.rotation.x = -0.15;
        compGroup.add(headGroup);

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3, metalness: 0.7 });
        const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(52, 34, 5), frameMat);
        headGroup.add(frameMesh);

        const ventMesh = new THREE.Mesh(new THREE.BoxGeometry(36, 12, 1), new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.2 }));
        ventMesh.position.set(0, 0, -2.6);
        headGroup.add(ventMesh);

        const screenCanvas = document.createElement('canvas');
        screenCanvas.width = 256;
        screenCanvas.height = 160;
        const ctx = screenCanvas.getContext('2d');

        ctx.fillStyle = '#060a17';
        ctx.fillRect(0, 0, 256, 160);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('🦜 BIRD SHOW MASTER CONTROL', 12, 24);

        const screenTexture = new THREE.CanvasTexture(screenCanvas);
        const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
        const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(48, 30), screenMat);
        screenMesh.position.set(0, 0, 2.6);
        headGroup.add(screenMesh);

        const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), ledMat);
        ledMesh.position.set(22, -15, 2.7);
        headGroup.add(ledMesh);

        const screenLight = new THREE.PointLight(0x00f0ff, 1.2, 90);
        screenLight.position.set(0, 0, 8);
        headGroup.add(screenLight);

        this.compScreen = {
            group: compGroup,
            headGroup: headGroup,
            canvas: screenCanvas,
            ctx: ctx,
            texture: screenTexture,
            light: screenLight,
            ledMat: ledMat
        };

        return compGroup;
    }

    buildParrot(bodyColorHex, wingColorHex, chestColorHex, label) {
        const root = new THREE.Group();

        const poleHeight = 140;
        const poleGeo = new THREE.CylinderGeometry(7, 9, poleHeight, 16);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = poleHeight / 2;
        pole.castShadow = true;
        root.add(pole);

        const turnGroup = new THREE.Group();
        turnGroup.position.y = poleHeight;
        root.add(turnGroup);

        const bowGroup = new THREE.Group();
        turnGroup.add(bowGroup);

        const shimmyGroup = new THREE.Group();
        bowGroup.add(shimmyGroup);

        const barGeo = new THREE.CylinderGeometry(6, 6, 80, 16);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.rotation.z = Math.PI / 2;
        bar.castShadow = true;
        shimmyGroup.add(bar);

        const parrotGroup = new THREE.Group();
        parrotGroup.position.y = 14;
        shimmyGroup.add(parrotGroup);

        const bodyGeo = new THREE.ConeGeometry(25, 75, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColorHex, roughness: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI;
        body.position.y = 40;
        body.castShadow = true;
        parrotGroup.add(body);

        const chestGeo = new THREE.SphereGeometry(20, 16, 16);
        const chestMat = new THREE.MeshStandardMaterial({ color: chestColorHex, roughness: 0.4 });
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.set(0, 40, 10);
        parrotGroup.add(chest);

        const headGroup = new THREE.Group();
        headGroup.position.set(0, 82, 3);
        parrotGroup.add(headGroup);

        const headGeo = new THREE.SphereGeometry(30, 24, 24);
        const headMat = new THREE.MeshStandardMaterial({ color: bodyColorHex, roughness: 0.4 });
        const head = new THREE.Mesh(headGeo, headMat);
        headGroup.add(head);

        const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.2, metalness: 0.1 });
        const upperBeakGeo = new THREE.ConeGeometry(15, 42, 16);
        const upperBeak = new THREE.Mesh(upperBeakGeo, beakMat);
        upperBeak.rotation.x = 1.25;
        upperBeak.position.set(0, -3, 27);
        upperBeak.castShadow = true;
        headGroup.add(upperBeak);

        const lowerBeakGroup = new THREE.Group();
        lowerBeakGroup.position.set(0, -11, 24);
        headGroup.add(lowerBeakGroup);

        const lowerBeakGeo = new THREE.ConeGeometry(13, 35, 16);
        const lowerBeak = new THREE.Mesh(lowerBeakGeo, beakMat);
        lowerBeak.rotation.x = 1.45;
        lowerBeak.position.set(0, -3, 11);
        lowerBeak.castShadow = true;
        lowerBeakGroup.add(lowerBeak);

        const mouthInsideMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
        const tongueMesh = new THREE.Mesh(new THREE.SphereGeometry(7.5, 12, 12), mouthInsideMat);
        tongueMesh.scale.set(1.0, 0.4, 1.8);
        tongueMesh.position.set(0, 0, 8);
        lowerBeakGroup.add(tongueMesh);

        const mouthGlowLight = new THREE.PointLight(0xff2244, 0, 70);
        mouthGlowLight.position.set(0, -3, 16);
        headGroup.add(mouthGlowLight);

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyelidMat = new THREE.MeshStandardMaterial({ color: bodyColorHex, roughness: 0.4 });

        const leftEyeGroup = new THREE.Group();
        leftEyeGroup.position.set(-18, 6, 18);
        headGroup.add(leftEyeGroup);

        const rightEyeGroup = new THREE.Group();
        rightEyeGroup.position.set(18, 6, 18);
        headGroup.add(rightEyeGroup);

        [leftEyeGroup, rightEyeGroup].forEach(g => {
            const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(7.5, 16, 16), eyeMat);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(4.0, 16, 16), pupilMat);
            pupil.position.z = 5.2;
            g.add(eyeBall);
            g.add(pupil);

            const eyelid = new THREE.Mesh(new THREE.SphereGeometry(8.0, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), eyelidMat);
            eyelid.rotation.x = -Math.PI / 2;
            eyelid.name = "eyelid";
            g.add(eyelid);
        });

        const leftWingGroup = new THREE.Group();
        leftWingGroup.position.set(-24, 52, 0);
        parrotGroup.add(leftWingGroup);

        const rightWingGroup = new THREE.Group();
        rightWingGroup.position.set(24, 52, 0);
        parrotGroup.add(rightWingGroup);

        const wingGeo = new THREE.BoxGeometry(8, 55, 25);
        const wingMat = new THREE.MeshStandardMaterial({ color: wingColorHex, roughness: 0.5 });

        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(-15, -18, 0);
        leftWing.rotation.z = -0.3;
        leftWingGroup.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(15, -18, 0);
        rightWing.rotation.z = 0.3;
        rightWingGroup.add(rightWing);

        const tailGeo = new THREE.BoxGeometry(20, 65, 5);
        const tailMat = new THREE.MeshStandardMaterial({ color: wingColorHex });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, 5, -15);
        tail.rotation.x = -0.4;
        parrotGroup.add(tail);

        root.userData = {
            turnGroup,
            bowGroup,
            shimmyGroup,
            lowerBeakGroup,
            leftEyeGroup,
            rightEyeGroup,
            leftWingGroup,
            rightWingGroup,
            mouthGlowLight
        };

        return root;
    }

    buildCantileveredSpotlight(sideDir, lightColor) {
        const group = new THREE.Group();

        const anchorX = sideDir * 32;
        const anchorY = -8;
        const anchorZ = 218;

        const anchorBaseMesh = new THREE.Mesh(
            new THREE.BoxGeometry(22, 14, 22),
            new THREE.MeshStandardMaterial({ color: 0x11111f, metalness: 0.85, roughness: 0.3 })
        );
        anchorBaseMesh.position.set(anchorX, anchorY, anchorZ);
        anchorBaseMesh.castShadow = true;
        group.add(anchorBaseMesh);

        const clampMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(8, 8, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.9, roughness: 0.2 })
        );
        clampMesh.position.set(anchorX, anchorY + 10, anchorZ);
        group.add(clampMesh);

        const cantileverX = sideDir * 48;
        const cantileverY = 38;
        const cantileverZ = 315;

        const startVec = new THREE.Vector3(anchorX, anchorY + 10, anchorZ);
        const endVec = new THREE.Vector3(cantileverX, cantileverY, cantileverZ);
        const rodLength = startVec.distanceTo(endVec);

        const rodGeo = new THREE.CylinderGeometry(5, 5, rodLength, 16);
        const rodMat = new THREE.MeshStandardMaterial({ color: 0xaaaaee, metalness: 0.95, roughness: 0.15 });
        const metalRod = new THREE.Mesh(rodGeo, rodMat);

        const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
        metalRod.position.copy(midPoint);
        metalRod.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            endVec.clone().sub(startVec).normalize()
        );
        metalRod.castShadow = true;
        group.add(metalRod);

        const strutStart = new THREE.Vector3(anchorX + sideDir * 15, anchorY - 4, anchorZ - 10);
        const strutLength = strutStart.distanceTo(endVec);
        const strutGeo = new THREE.CylinderGeometry(3.5, 3.5, strutLength, 12);
        const strutMesh = new THREE.Mesh(strutGeo, rodMat);
        const strutMid = new THREE.Vector3().addVectors(strutStart, endVec).multiplyScalar(0.5);
        strutMesh.position.copy(strutMid);
        strutMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            endVec.clone().sub(strutStart).normalize()
        );
        group.add(strutMesh);

        const mountBracket = new THREE.Mesh(
            new THREE.CylinderGeometry(7, 7, 14, 12),
            new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.9, roughness: 0.3 })
        );
        mountBracket.position.set(cantileverX, cantileverY, cantileverZ);
        group.add(mountBracket);

        const shimmyGroup = new THREE.Group();
        shimmyGroup.position.set(cantileverX, cantileverY, cantileverZ);
        group.add(shimmyGroup);

        const tiltGroup = new THREE.Group();
        shimmyGroup.add(tiltGroup);

        const fixtureGeo = new THREE.CylinderGeometry(8, 12, 22, 16);
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.9, roughness: 0.2 });
        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.rotation.x = Math.PI / 2;
        fixture.castShadow = true;
        tiltGroup.add(fixture);

        const spotLight = new THREE.SpotLight(lightColor, 2.5, 500, Math.PI / 5, 0.4, 1);
        spotLight.position.set(0, 0, 10);
        tiltGroup.add(spotLight);

        const targetObj = new THREE.Object3D();
        targetObj.position.set(-sideDir * 60, 15, -375);
        tiltGroup.add(targetObj);
        spotLight.target = targetObj;

        const coneGeo = new THREE.ConeGeometry(55, 220, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.rotation.x = -Math.PI / 2;
        coneMesh.position.z = -110;
        tiltGroup.add(coneMesh);

        return {
            group,
            shimmyGroup,
            tiltGroup,
            spotLight,
            coneMesh
        };
    }

    buildSmallBird(colorHex, type, options = {}) {
        const group = new THREE.Group();

        const isCenter = (type === "center");
        const hasSpotlight = options.hasSpotlight !== false;
        const hasRelay = !!options.hasRelay;

        const bodyRadius = isCenter ? 24 : 17;
        const headRadius = isCenter ? 26 : 12;

        let shimmyGroup = group;
        let turnGroup = null;
        let bowGroup = null;

        if (isCenter) {
            const pedGeo = new THREE.CylinderGeometry(8, 10, 36, 16);
            const pedMat = new THREE.MeshStandardMaterial({ color: 0x4a321a, roughness: 0.6 });
            const ped = new THREE.Mesh(pedGeo, pedMat);
            ped.position.y = 18;
            ped.castShadow = true;
            group.add(ped);

            turnGroup = new THREE.Group();
            turnGroup.position.y = 36;
            group.add(turnGroup);

            const turnRing = new THREE.Mesh(
                new THREE.TorusGeometry(12, 2.5, 12, 24),
                new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 })
            );
            turnRing.rotation.x = Math.PI / 2;
            turnGroup.add(turnRing);

            bowGroup = new THREE.Group();
            turnGroup.add(bowGroup);

            const bowBracket = new THREE.Mesh(
                new THREE.BoxGeometry(16, 12, 14),
                new THREE.MeshStandardMaterial({ color: 0x00d4ff, metalness: 0.8, roughness: 0.2 })
            );
            bowGroup.add(bowBracket);

            shimmyGroup = new THREE.Group();
            bowGroup.add(shimmyGroup);

            const barGeo = new THREE.CylinderGeometry(5, 5, 75, 16);
            const barMat = new THREE.MeshStandardMaterial({ color: 0xc88a38, roughness: 0.4 });
            const perchBar = new THREE.Mesh(barGeo, barMat);
            perchBar.rotation.z = Math.PI / 2;
            perchBar.castShadow = true;
            shimmyGroup.add(perchBar);

            const hubGeo = new THREE.CylinderGeometry(7, 7, 12, 16);
            const hubMat = new THREE.MeshStandardMaterial({ color: 0xff00cc, metalness: 0.8, roughness: 0.2 });
            const hub = new THREE.Mesh(hubGeo, hubMat);
            shimmyGroup.add(hub);

            const centerSpot = new THREE.PointLight(0xffd700, 3.0, 180);
            centerSpot.position.set(0, 45, 20);
            group.add(centerSpot);

        } else {
            const basePlatformGeo = new THREE.CylinderGeometry(20, 22, 10, 24);
            const basePlatformMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.4, metalness: 0.6 });
            const basePlatform = new THREE.Mesh(basePlatformGeo, basePlatformMat);
            basePlatform.position.y = 5;
            basePlatform.castShadow = true;
            group.add(basePlatform);

            const basePillarGeo = new THREE.CylinderGeometry(10, 12, 16, 16);
            const basePillarMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.5 });
            const basePillar = new THREE.Mesh(basePillarGeo, basePillarMat);
            basePillar.position.y = 18;
            basePillar.castShadow = true;
            group.add(basePillar);

            shimmyGroup = new THREE.Group();
            shimmyGroup.position.y = 26;
            group.add(shimmyGroup);
        }

        const birdGroup = new THREE.Group();
        birdGroup.position.y = isCenter ? 20 : 10;
        shimmyGroup.add(birdGroup);

        const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(bodyRadius, 16, 16), new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 }));
        bodyMesh.castShadow = true;
        birdGroup.add(bodyMesh);

        const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 16, 16), new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 }));
        headMesh.position.set(0, isCenter ? 22 : 14, isCenter ? 10 : 7);
        headMesh.castShadow = true;
        birdGroup.add(headMesh);

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const xEyeOff = isCenter ? -12 : -6;
        const yEyeOff = isCenter ? 26 : 17;
        const zEyeOff = isCenter ? 28 : 16;
        [xEyeOff, -xEyeOff].forEach(xOff => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(isCenter ? 6.0 : 2.8, 12, 12), eyeMat);
            eye.position.set(xOff, yEyeOff, zEyeOff);
            birdGroup.add(eye);

            const pupil = new THREE.Mesh(new THREE.SphereGeometry(isCenter ? 3.2 : 1.4, 12, 12), pupilMat);
            pupil.position.set(xOff, yEyeOff, zEyeOff + 2.5);
            birdGroup.add(pupil);
        });

        const beakMesh = new THREE.Mesh(
            new THREE.ConeGeometry(isCenter ? 12 : 5, isCenter ? 30 : 14, 12),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3 })
        );
        beakMesh.rotation.x = 1.3;
        beakMesh.position.set(0, isCenter ? 24 : 14, isCenter ? 30 : 17);
        beakMesh.castShadow = true;
        birdGroup.add(beakMesh);

        const wingMat = new THREE.MeshStandardMaterial({ color: colorHex });
        const wingRad = isCenter ? 12 : 8;
        const xWingOff = isCenter ? -22 : -15;

        const leftWing = new THREE.Mesh(new THREE.SphereGeometry(wingRad, 12, 12), wingMat);
        leftWing.scale.set(0.4, 1.3, 1.5);
        leftWing.position.set(xWingOff, 0, 0);
        leftWing.rotation.z = -0.3;
        birdGroup.add(leftWing);

        const rightWing = new THREE.Mesh(new THREE.SphereGeometry(wingRad, 12, 12), wingMat);
        rightWing.scale.set(0.4, 1.3, 1.5);
        rightWing.position.set(-xWingOff, 0, 0);
        rightWing.rotation.z = 0.3;
        birdGroup.add(rightWing);

        let relayGlow = null;
        if (hasRelay) {
            const ringGeo = new THREE.TorusGeometry(22, 3, 12, 24);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.0 });
            relayGlow = new THREE.Mesh(ringGeo, ringMat);
            relayGlow.rotation.x = Math.PI / 2;
            relayGlow.position.y = -5;
            birdGroup.add(relayGlow);
        }

        let spotLight = null;
        if (hasSpotlight) {
            spotLight = new THREE.PointLight(colorHex, 2.5, 160);
            spotLight.position.set(0, 35, 20);
            group.add(spotLight);
        }

        return { group, birdGroup, turnGroup, bowGroup, shimmyGroup, beakMesh, relayGlow, spotLight };
    }

    init2DFallback() {
        this.webglSupported = false;
        this.container.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.borderRadius = '8px';
        canvas.style.background = '#0a0d18';
        this.container.appendChild(canvas);

        this.fallbackCanvas = canvas;
        this.fallbackCtx = canvas.getContext('2d');

        const resize2d = () => {
            const w = this.container.clientWidth || 800;
            const h = this.container.clientHeight || 480;
            canvas.width = w;
            canvas.height = h;
        };
        resize2d();
        window.addEventListener('resize', resize2d);

        let startTime = Date.now();
        const render2DFrame = () => {
            requestAnimationFrame(render2DFrame);
            const time = (Date.now() - startTime) / 1000;
            this.draw2DStage(this.fallbackCtx, canvas.width, canvas.height, time);
        };
        render2DFrame();
    }

    draw2DStage(ctx, w, h, time) {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = '#0a0d18';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('🎭 REAL-TIME STAGE VISUALIZER (2D MODE)', 15, 25);

        const cx = w / 2;
        const cy = h / 2 + 15;
        const stageRadius = Math.min(w, h) * 0.38;

        // Outer Base Ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, stageRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#111827';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rotating Base Turntable Disc & Spokes
        const baseAngle = (((this.state.main_base && this.state.main_base.servo_angle !== undefined) ? this.state.main_base.servo_angle : 90) - 90) * (Math.PI / 180);
        ctx.beginPath();
        ctx.arc(cx, cy, stageRadius * 0.88, 0, Math.PI * 2);
        ctx.fillStyle = '#26170d';
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (let i = 0; i < 12; i++) {
            const a = baseAngle + (i / 12) * Math.PI * 2;
            const x1 = cx + Math.cos(a) * (stageRadius * 0.2);
            const y1 = cy + Math.sin(a) * (stageRadius * 0.2);
            const x2 = cx + Math.cos(a) * (stageRadius * 0.85);
            const y2 = cy + Math.sin(a) * (stageRadius * 0.85);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, stageRadius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#1a2035';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();

        const drawBirdNode = (x, y, radius, color, label, isActive, mouthOpen, wingFlap, chirpGlow) => {
            ctx.save();
            ctx.translate(x, y);

            if (chirpGlow) {
                ctx.beginPath();
                ctx.arc(0, 0, radius + 12 + Math.sin(time * 12) * 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 255, 102, 0.35)';
                ctx.fill();
            }

            if (wingFlap) {
                const flapOffset = Math.sin(time * 18) * 8;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(-radius - 6, flapOffset, 8, 14, -0.4, 0, Math.PI * 2);
                ctx.ellipse(radius + 6, -flapOffset, 8, 14, 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = isActive ? '#00ff88' : '#ffffff';
            ctx.lineWidth = isActive ? 3 : 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-radius * 0.35, -radius * 0.2, radius * 0.22, 0, Math.PI * 2);
            ctx.arc(radius * 0.35, -radius * 0.2, radius * 0.22, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-radius * 0.35, -radius * 0.2, radius * 0.1, 0, Math.PI * 2);
            ctx.arc(radius * 0.35, -radius * 0.2, radius * 0.1, 0, Math.PI * 2);
            ctx.fill();

            const beakY = radius * 0.3;
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            if (mouthOpen) {
                const mouthGap = 6 + Math.sin(time * 16) * 3;
                ctx.moveTo(-radius * 0.3, beakY);
                ctx.lineTo(0, beakY + radius * 0.6);
                ctx.lineTo(radius * 0.3, beakY);
                ctx.fill();

                ctx.fillStyle = '#ff0044';
                ctx.beginPath();
                ctx.arc(0, beakY + 2, mouthGap, 0, Math.PI);
                ctx.fill();
            } else {
                ctx.moveTo(-radius * 0.25, beakY);
                ctx.lineTo(0, beakY + radius * 0.45);
                ctx.lineTo(radius * 0.25, beakY);
                ctx.fill();
            }

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, 0, radius + 14);

            ctx.restore();
        };

        const p1 = this.state.parrot1 || {};
        const p2 = this.state.parrot2 || {};

        const p1Active = (this.state.is_speaking && this.state.active_speaker === 'parrot1') || p1.mouth_eyes_channel_a === 'mouth_open';
        const p2Active = (this.state.is_speaking && this.state.active_speaker === 'parrot2') || p2.mouth_eyes_channel_a === 'mouth_open';

        const p1x = cx - stageRadius * 0.5;
        const p1y = cy - stageRadius * 0.35;
        drawBirdNode(p1x, p1y, 22, '#ff2244', 'Parrot 1 (Left)', p1Active, p1.mouth_eyes_channel_a === 'mouth_open', p1.wings_channel_b, false);

        const p2x = cx + stageRadius * 0.5;
        const p2y = cy - stageRadius * 0.35;
        drawBirdNode(p2x, p2y, 22, '#00cc44', 'Parrot 2 (Right)', p2Active, p2.mouth_eyes_channel_a === 'mouth_open', p2.wings_channel_b, false);

        const drawSpotBeam = (sx, sy, tx, ty, color, intensity) => {
            if (intensity <= 0) return;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const angle = Math.atan2(ty - sy, tx - sx);
            const spread = 0.35;
            const dist = Math.hypot(tx - sx, ty - sy);
            ctx.lineTo(sx + Math.cos(angle - spread) * dist, sy + Math.sin(angle - spread) * dist);
            ctx.lineTo(sx + Math.cos(angle + spread) * dist, sy + Math.sin(angle + spread) * dist);
            ctx.closePath();

            const grad = ctx.createLinearGradient(sx, sy, tx, ty);
            grad.addColorStop(0, color.replace(')', ', 0.6)').replace('rgb', 'rgba'));
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        };

        const spot1X = cx - stageRadius * 0.8;
        const spot1Y = cy + stageRadius * 0.7;
        const spot2X = cx + stageRadius * 0.8;
        const spot2Y = cy + stageRadius * 0.7;

        drawSpotBeam(spot1X, spot1Y, p1x, p1y, 'rgb(255, 34, 68)', p1Active ? 1.0 : 0.3);
        drawSpotBeam(spot2X, spot2Y, p2x, p2y, 'rgb(0, 255, 136)', p2Active ? 1.0 : 0.3);

        const ctr = this.state.center_bird || {};
        const fl = this.state.front_left_bird || this.state.left_bird || {};
        const fr = this.state.front_right_bird || this.state.right_bird || {};
        const rl = this.state.rear_left_bird || {};
        const rr = this.state.rear_right_bird || {};

        drawBirdNode(cx, cy + stageRadius * 0.35, 16, '#ffd700', 'Center Bird', ctr.motor_moving, ctr.mouth_chirp || ctr.motor_moving, ctr.motor_moving, false);
        drawBirdNode(cx - stageRadius * 0.45, cy + stageRadius * 0.4, 13, '#ff00cc', 'Front Left', fl.moving, fl.relay_chirp, fl.moving, fl.relay_chirp);
        drawBirdNode(cx + stageRadius * 0.45, cy + stageRadius * 0.4, 13, '#00e5ff', 'Front Right', fr.moving, fr.relay_chirp, fr.moving, fr.relay_chirp);
        drawBirdNode(cx - stageRadius * 0.65, cy - stageRadius * 0.05, 13, '#aa00ff', 'Rear Left', rl.moving, false, rl.moving, false);
        drawBirdNode(cx + stageRadius * 0.65, cy - stageRadius * 0.05, 13, '#ff7700', 'Rear Right', rr.moving, false, rr.moving, false);

        ctx.save();
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = this.state.is_speaking ? '#00ff88' : '#00f0ff';
        ctx.lineWidth = 2;
        ctx.fillRect(cx + 15, cy + stageRadius * 0.45, 60, 35);
        ctx.strokeRect(cx + 15, cy + stageRadius * 0.45, 60, 35);

        ctx.fillStyle = '#00f0ff';
        ctx.font = '8px monospace';
        ctx.fillText('STAGE AI', cx + 22, cy + stageRadius * 0.45 + 12);

        for (let i = 0; i < 7; i++) {
            const hBar = this.state.is_speaking ? (4 + Math.abs(Math.sin(time * 10 + i)) * 12) : 3;
            ctx.fillStyle = i > 4 ? '#ff0077' : '#00ff88';
            ctx.fillRect(cx + 20 + i * 7, cy + stageRadius * 0.45 + 30 - hBar, 5, hBar);
        }
        ctx.restore();

        ctx.restore();
    }

    updateState(newState) {
        if (!newState) return;

        if (newState.is_speaking !== undefined) this.state.is_speaking = newState.is_speaking;
        if (newState.active_speaker) this.state.active_speaker = newState.active_speaker;
        if (newState.ai_sync_mode) this.state.ai_sync_mode = newState.ai_sync_mode;

        if (newState.main_base) this.state.main_base = newState.main_base;
        if (newState.parrot1) this.state.parrot1 = newState.parrot1;
        if (newState.parrot2) this.state.parrot2 = newState.parrot2;
        if (newState.center_bird) this.state.center_bird = newState.center_bird;

        if (newState.front_left_bird) this.state.front_left_bird = newState.front_left_bird;
        else if (newState.left_bird) this.state.front_left_bird = newState.left_bird;

        if (newState.front_right_bird) this.state.front_right_bird = newState.front_right_bird;
        else if (newState.right_bird) this.state.front_right_bird = newState.right_bird;

        if (newState.rear_left_bird) this.state.rear_left_bird = newState.rear_left_bird;
        if (newState.rear_right_bird) this.state.rear_right_bird = newState.rear_right_bird;
    }

    animate() {
        if (!this.webglSupported) return;
        requestAnimationFrame(() => this.animate());

        const elapsedTime = this.clock.getElapsedTime();
        if (this.controls && typeof this.controls.update === 'function') {
            this.controls.update();
        }

        if (this.stageRoot) {
            const targetRad = (((this.state.main_base && this.state.main_base.servo_angle !== undefined) ? this.state.main_base.servo_angle : 90) - 90) * (Math.PI / 180);
            this.stageRoot.rotation.y += (targetRad - this.stageRoot.rotation.y) * 0.15;
        }

        this.animateParrot(this.parrot1Group, this.state.parrot1, elapsedTime);
        this.animateParrot(this.parrot2Group, this.state.parrot2, elapsedTime + 1.2);

        this.animateSpotlight(this.spotlight1, this.state.parrot1 ? this.state.parrot1.spotlight : null, "parrot1", elapsedTime);
        this.animateSpotlight(this.spotlight2, this.state.parrot2 ? this.state.parrot2.spotlight : null, "parrot2", elapsedTime);

        this.animateSmallBird(this.centerBirdObj, this.state.center_bird, elapsedTime, "center");
        this.animateSmallBird(this.frontLeftBirdObj, this.state.front_left_bird || this.state.left_bird, elapsedTime, "front_left");
        this.animateSmallBird(this.frontRightBirdObj, this.state.front_right_bird || this.state.right_bird, elapsedTime, "front_right");
        this.animateSmallBird(this.rearLeftBirdObj, this.state.rear_left_bird, elapsedTime, "rear_left");
        this.animateSmallBird(this.rearRightBirdObj, this.state.rear_right_bird, elapsedTime, "rear_right");

        if (this.compScreen) {
            this.animateComputerScreen(elapsedTime);
        }

        this.renderer.render(this.scene, this.camera);
    }

    animateComputerScreen(time) {
        if (!this.compScreen || !this.compScreen.ctx) return;
        const ctx = this.compScreen.ctx;
        const isSpeaking = !!this.state.is_speaking;

        ctx.fillStyle = '#060a17';
        ctx.fillRect(0, 0, 256, 160);

        ctx.strokeStyle = isSpeaking ? '#00ff88' : '#00f0ff';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 156);

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('🦜 BIRD SHOW MASTER CONTROL', 10, 22);

        ctx.fillStyle = isSpeaking ? '#00ff88' : '#ffd700';
        ctx.font = '10px monospace';
        const speakerName = (this.state.active_speaker === 'parrot2') ? 'PARROT 2 (RIGHT)' : 'PARROT 1 (LEFT)';
        ctx.fillText(isSpeaking ? `🎙️ SPEAKING: ${speakerName}` : 'STANDBY - READY FOR AI SPEECH', 10, 40);

        for (let i = 0; i < 18; i++) {
            const seed = Math.sin(time * 12 + i * 0.7);
            const baseH = isSpeaking ? (25 + Math.abs(seed) * 65) : (8 + Math.abs(Math.sin(time * 2 + i * 0.3)) * 18);
            
            let barColor = '#00f0ff';
            if (i > 13) barColor = '#ff0077';
            else if (i > 8) barColor = '#ffd700';
            else if (i > 4) barColor = '#00ff88';

            ctx.fillStyle = barColor;
            ctx.fillRect(12 + i * 13, 142 - baseH, 9, baseH);
        }

        const dateStr = new Date().toLocaleTimeString();
        ctx.fillStyle = '#8a99ad';
        ctx.font = '10px monospace';
        ctx.fillText(`TIME: ${dateStr}`, 125, 58);

        this.compScreen.texture.needsUpdate = true;

        if (this.compScreen.light) {
            this.compScreen.light.intensity = isSpeaking ? (1.5 + Math.sin(time * 10) * 0.8) : 0.6;
        }
    }

    animateParrot(group, pState, time) {
        if (!group || !pState) return;

        const u = group.userData;
        if (!u) return;

        const perch = pState.perch || { turn: 90, bow: 90, shimmy: 90 };
        const turnRad = ((perch.turn !== undefined ? perch.turn : 90) - 90) * (Math.PI / 180);
        const bowRad = ((perch.bow !== undefined ? perch.bow : 90) - 90) * (Math.PI / 180);
        const shimmyRad = ((perch.shimmy !== undefined ? perch.shimmy : 90) - 90) * (Math.PI / 180);

        if (u.turnGroup) u.turnGroup.rotation.y += (turnRad - u.turnGroup.rotation.y) * 0.1;
        if (u.bowGroup) u.bowGroup.rotation.x += (bowRad - u.bowGroup.rotation.x) * 0.1;
        if (u.shimmyGroup) u.shimmyGroup.rotation.z += (shimmyRad - u.shimmyGroup.rotation.z) * 0.1;

        const mouthEyesMode = pState.mouth_eyes_channel_a || "off";

        if (u.lowerBeakGroup) {
            if (mouthEyesMode === "mouth_open") {
                const targetMouth = 0.75 + Math.sin(time * 16) * 0.2;
                u.lowerBeakGroup.rotation.x += (targetMouth - u.lowerBeakGroup.rotation.x) * 0.3;
                if (u.mouthGlowLight) u.mouthGlowLight.intensity = 2.5;
            } else {
                u.lowerBeakGroup.rotation.x += (0 - u.lowerBeakGroup.rotation.x) * 0.3;
                if (u.mouthGlowLight) u.mouthGlowLight.intensity = 0.0;
            }
        }

        let eyelidOpen = 0;
        if (mouthEyesMode === "eyes_blink") {
            eyelidOpen = (Math.sin(time * 12) > 0) ? 1.0 : 0.0;
        }
        if (u.leftEyeGroup && u.rightEyeGroup) {
            [u.leftEyeGroup, u.rightEyeGroup].forEach(g => {
                const eyelid = g.getObjectByName("eyelid");
                if (eyelid) {
                    const targetRot = -Math.PI / 2 + eyelidOpen * (Math.PI / 2);
                    eyelid.rotation.x += (targetRot - eyelid.rotation.x) * 0.3;
                }
            });
        }

        if (u.leftWingGroup && u.rightWingGroup) {
            if (pState.wings_channel_b) {
                const wingFlap = Math.sin(time * 18) * 0.6;
                u.leftWingGroup.rotation.z = wingFlap;
                u.rightWingGroup.rotation.z = -wingFlap;
            } else {
                u.leftWingGroup.rotation.z += (0 - u.leftWingGroup.rotation.z) * 0.1;
                u.rightWingGroup.rotation.z += (0 - u.rightWingGroup.rotation.z) * 0.1;
            }
        }
    }

    animateSpotlight(spotObj, spotState, parrotId, time) {
        if (!spotObj || !spotState) return;

        const isTalking = (this.state.is_speaking && this.state.active_speaker === parrotId) || 
                          (this.state[parrotId] && this.state[parrotId].mouth_eyes_channel_a === "mouth_open");

        let baseShimmy = spotState.shimmy !== undefined ? spotState.shimmy : (spotState.pan !== undefined ? spotState.pan : 90);
        let baseTilt = spotState.tilt !== undefined ? spotState.tilt : 90;
        let targetIntensity = (spotState.intensity !== undefined ? spotState.intensity : 100) / 100;

        if (isTalking) {
            targetIntensity = 1.0;

            const circularShimmyOffset = Math.sin(time * 3.5) * 16.0;
            const circularTiltOffset = Math.cos(time * 3.5) * 12.0;

            baseShimmy += circularShimmyOffset;
            baseTilt += circularTiltOffset;
        } else if (this.state.is_speaking) {
            targetIntensity = 0.25;
        }

        const shimmyRad = (baseShimmy - 90) * (Math.PI / 180);
        const tiltRad = (baseTilt - 90) * (Math.PI / 180);

        if (spotObj.shimmyGroup) spotObj.shimmyGroup.rotation.z += (shimmyRad - spotObj.shimmyGroup.rotation.z) * 0.2;
        else if (spotObj.panGroup) spotObj.panGroup.rotation.y += (shimmyRad - spotObj.panGroup.rotation.y) * 0.2;

        if (spotObj.tiltGroup) spotObj.tiltGroup.rotation.x += (tiltRad - spotObj.tiltGroup.rotation.x) * 0.2;

        const intensityVal = targetIntensity * 3.5;
        if (spotObj.spotLight) spotObj.spotLight.intensity = intensityVal;
        if (spotObj.coneMesh && spotObj.coneMesh.material) {
            spotObj.coneMesh.material.opacity = targetIntensity * 0.45;
        }
    }

    animateSmallBird(birdObj, bState, time, type) {
        if (!birdObj || !bState) return;

        const isCenter = (type === "center");

        if (birdObj.spotLight) {
            const isLit = bState.spotlight !== false;
            birdObj.spotLight.intensity = isLit ? 2.5 : 0.0;
        }

        if (birdObj.relayGlow && birdObj.relayGlow.material) {
            birdObj.relayGlow.material.opacity = bState.relay_chirp ? 0.9 : 0.0;
        }

        if (isCenter && bState.perch && birdObj.turnGroup) {
            const turnRad = ((bState.perch.turn !== undefined ? bState.perch.turn : 90) - 90) * (Math.PI / 180);
            const bowRad = ((bState.perch.bow !== undefined ? bState.perch.bow : 90) - 90) * (Math.PI / 180);
            const shimmyRad = ((bState.perch.shimmy !== undefined ? bState.perch.shimmy : 90) - 90) * (Math.PI / 180);

            birdObj.turnGroup.rotation.y += (turnRad - birdObj.turnGroup.rotation.y) * 0.1;
            if (birdObj.bowGroup) birdObj.bowGroup.rotation.x += (bowRad - birdObj.bowGroup.rotation.x) * 0.1;
            if (birdObj.shimmyGroup) birdObj.shimmyGroup.rotation.z += (shimmyRad - birdObj.shimmyGroup.rotation.z) * 0.1;
        }

        const isMotorMoving = !!(bState.motor_moving || bState.moving || bState.mouth_chirp);

        if (isMotorMoving) {
            birdObj.group.rotation.y = Math.sin(time * 5) * 0.35;
            if (birdObj.birdGroup) birdObj.birdGroup.position.y = (isCenter ? 14 : 10) + Math.abs(Math.sin(time * 8)) * 5;

            if (birdObj.beakMesh) {
                const beakScale = 1.0 + Math.abs(Math.sin(time * 16)) * 0.35;
                birdObj.beakMesh.scale.set(1.0, beakScale, 1.0 + (beakScale - 1.0) * 0.5);
            }
        } else {
            birdObj.group.rotation.y += (0 - birdObj.group.rotation.y) * 0.15;
            if (birdObj.birdGroup) birdObj.birdGroup.position.y = (isCenter ? 14 : 10);
            if (birdObj.beakMesh) {
                birdObj.beakMesh.scale.set(1.0, 1.0, 1.0);
            }
        }
    }

    onWindowResize() {
        if (!this.container) return;
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 480;
        if (width === 0 || height === 0) return;

        if (this.webglSupported && this.camera && this.renderer) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height, false);
        }
    }
}
