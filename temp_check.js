
  /* -------------------------------------------------------------
     Audio Synthesizer (Web Audio API for tactile feedback)
  ------------------------------------------------------------- */
  const AudioEngine = {
    ctx: null,
    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    playBeep(freq = 880, duration = 0.08, type = 'sine') {
      try {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    },
    playDoorChime(open = true) {
      try {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        if (open) {
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
        } else {
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
        }
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {}
    }
  };

  /* -------------------------------------------------------------
     Global State & Scene References
  ------------------------------------------------------------- */
  let scene, camera, renderer, orbitControls, container;
  let isWalkMode = true;
  let isNightLighting = true;
  let ambientLight;
  let mainSpotlights = [];
  let kioskGroupList = [];
  let interactiveScreens = [];
  let humanCharacters = [];
  let tokenDisplayCanvas, tokenDisplayTexture;
  let currentTokenNumber = 124;

  // Automatic Sliding Glass Door State
  let doorLeftMesh, doorRightMesh, doorSensorLedMat;
  let doorForcedMode = 'auto'; // 'auto' | 'open' | 'closed'
  let doorOpenPercent = 0;
  let doorTargetPercent = 0;
  let previousDoorAudibleState = false;

  // First-Person Player State
  const player = {
    position: new THREE.Vector3(0, 1.65, 3.6),
    velocity: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    speed: 3.4,
    sprintMultiplier: 1.75,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    keys: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false
    }
  };

  /* -------------------------------------------------------------
     Procedural Textures
  ------------------------------------------------------------- */
  function createOakWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8b6343';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(65, 42, 24, 0.16)' : 'rgba(180, 138, 98, 0.12)';
      ctx.fillRect(0, i * 8.5, 512, 4 + (i % 3));
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function createFloorTileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    // Calm warm nude / travertine stone base
    ctx.fillStyle = '#d9cfc1';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle organic stone texture variation
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 1 + Math.random() * 4;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 165, 145, 0.14)' : 'rgba(245, 238, 228, 0.18)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine warm taupe grout lines
    ctx.strokeStyle = '#bfb2a0';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);
    ctx.strokeRect(258, 2, 252, 252);
    ctx.strokeRect(2, 258, 252, 252);
    ctx.strokeRect(258, 258, 252, 252);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 6);
    return tex;
  }

  function createBrandBannerTexture(title, subtitle, bgColor = '#1e3a8a') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 192);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 86);

    ctx.fillStyle = '#fde68a';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle, 256, 134);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  function createFrostedGlassDecalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    // Frosted privacy band across center
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fillRect(0, 175, 512, 170);

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 175, 512, 10);
    ctx.fillRect(0, 335, 512, 10);

    ctx.fillStyle = '#1d4ed8';
    ctx.font = '800 54px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CSC • AADHAAR', 256, 250);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('DIGITAL INDIA SEVA KENDRA', 256, 292);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText('AUTOMATIC SENSOR DOOR • 24x7', 256, 322);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  function createKioskScreenTexture(podIndex, stepIndex) {
    const steps = [
      {
        title: 'Aadhaar Self-Service',
        sub: 'Touch anywhere to begin • English / हिंदी',
        cards: ['Update Address & Demographics', 'Biometric & Photo Update', 'Download / Order PVC Card']
      },
      {
        title: 'Biometric Capture',
        sub: 'Align eyes with Iris Lens & place finger',
        cards: ['1. Face Photo Verified', '2. Iris Scan Ready (1550mm)', '3. Fingerprint Platen Active']
      },
      {
        title: 'Document Scanner',
        sub: 'Place A4 Proof of Address on bed (900mm)',
        cards: ['Auto-OCR Verification Ready', 'DigiLocker Cloud Sync', 'Instant URN Slip Print']
      }
    ];

    const currentStep = steps[stepIndex % steps.length];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 1024);

    // Top Header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 110);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.fillText(`POD 0${podIndex} • UIDAI`, 32, 65);

    // Main Prompt
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 38px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(currentStep.title, 32, 185);

    ctx.fillStyle = '#475569';
    ctx.font = '500 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(currentStep.sub, 32, 225);

    // Interactive Cards
    currentStep.cards.forEach((label, i) => {
      const y = 285 + i * 165;
      ctx.fillStyle = i === 0 ? '#eef2ff' : '#ffffff';
      ctx.strokeStyle = i === 0 ? '#4f46e5' : '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(32, y, 448, 135, 22);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = i === 0 ? '#312e81' : '#1e293b';
      ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(label, 56, y + 76);
    });

    // Bottom CTA Button
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.roundRect(32, 830, 448, 95, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAP SCREEN TO CONTINUE →', 256, 888);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return { texture: tex, currentStep };
  }

  /* -------------------------------------------------------------
     Architectural Room Construction (Vestibule, HVAC, Louvers, Doors)
  ------------------------------------------------------------- */
  function buildBankArchitecture() {
    const oakWoodTex = createOakWoodTexture();
    const floorTileTex = createFloorTileTexture();

    // 1. Satin-Matte Calm Nude Travertine Tile Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8.2),
      new THREE.MeshStandardMaterial({ map: floorTileTex, roughness: 0.36, metalness: 0.04 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1.5);
    floor.receiveShadow = true;
    scene.add(floor);

    // Muted Warm Terracotta/Amber Safety Boundary Line (1.4m in front of Kiosks)
    const safetyLine = new THREE.Mesh(
      new THREE.PlaneGeometry(12.8, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xd97706 })
    );
    safetyLine.rotation.x = -Math.PI / 2;
    safetyLine.position.set(0, 0.004, 0.85);
    scene.add(safetyLine);

    // 2. Warm Linen / Soft Oatmeal Plaster Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.72 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(16, 4.0, 0.25), wallMat);
    backWall.position.set(0, 2.0, -1.2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.0, 7.0), wallMat);
    leftWall.position.set(-7.9, 2.0, 2.2);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.0, 7.0), wallMat);
    rightWall.position.set(7.9, 2.0, 2.2);
    scene.add(leftWall, rightWall);

    // Backlit Warm Wood Feature Wall Panels & CSC / Digital India Wall Signage (From Reference)
    const woodFeatureWall = new THREE.Mesh(
      new THREE.BoxGeometry(13.4, 2.7, 0.08),
      new THREE.MeshStandardMaterial({ map: oakWoodTex, roughness: 0.45 })
    );
    woodFeatureWall.position.set(0, 1.55, -1.06);
    scene.add(woodFeatureWall);

    const cscSignTex = createBrandBannerTexture('CSC • AADHAAR SEVA', 'COMMON SERVICE CENTRE • BANK BC POINT', '#1e3a8a');
    const rightWallSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.0),
      new THREE.MeshBasicMaterial({ map: cscSignTex })
    );
    rightWallSign.position.set(7.76, 2.15, 2.1);
    rightWallSign.rotation.y = -Math.PI / 2;
    scene.add(rightWallSign);

    // 3. Soft Nude / Warm Alabaster POP False Ceiling, Warm Cove Lighting & Recessed Downlights
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 7.2),
      new THREE.MeshStandardMaterial({ color: 0xe3d8c8, roughness: 0.65 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3.85, 2.2);
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    // Soft Recessed Ceiling Coffer Tray for Realistic Architectural Depth
    const cofferMat = new THREE.MeshStandardMaterial({ color: 0xd7cab8, roughness: 0.7 });
    const cofferBorderFront = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.14, 0.35), cofferMat);
    cofferBorderFront.position.set(0, 3.78, 5.15);
    const cofferBorderBack = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.14, 0.35), cofferMat);
    cofferBorderBack.position.set(0, 3.78, -0.75);
    scene.add(cofferBorderFront, cofferBorderBack);

    // Warm Amber-Gold Cove Lighting Perimeter Strips
    const coveMat = new THREE.MeshBasicMaterial({ color: 0xfcd34d });
    const coveFront = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.04, 0.06), coveMat);
    coveFront.position.set(0, 3.75, 4.96);
    const coveBack = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.04, 0.06), coveMat);
    coveBack.position.set(0, 3.75, -0.56);
    scene.add(coveFront, coveBack);

    // Warm Recessed LED Pot Downlights (3200K warm architectural tone)
    [-5.0, -1.7, 1.7, 5.0].forEach(lx => {
      [0.4, 3.4].forEach(lz => {
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20),
          new THREE.MeshBasicMaterial({ color: 0xfff3d6 })
        );
        pot.position.set(lx, 3.84, lz);
        scene.add(pot);
      });
    });

    // 4. Centralized HVAC System (4-Way Ceiling Cassette AC Units, Linear Diffusers & Thermostat)
    buildCentralizedHVAC();

    // 5. Privacy Oak Slat Louvers Between the 4 Kiosk Pods
    buildPrivacyLouvers(oakWoodTex);

    // 6. Automatic Sliding Glass Entrance Doors & Motion Sensor
    buildEntranceGlassDoors();

    // 7. Outdoor Street Plaza Backdrop
    buildOutdoorBackdrop();

    // 8. Vestibule Props (Live Queue Board, Bench, Water Dispenser, Fire Extinguisher, Bins, Plants)
    buildVestibuleProps();

    // 9. Realistic 1:1 Scale Human Citizens
    buildHumanCharacters();
  }

  /* -------------------------------------------------------------
     Centralized HVAC System (Ceiling Cassettes, Linear Diffusers & Thermostat)
  ------------------------------------------------------------- */
  function buildCentralizedHVAC() {
    const acHousingMat = new THREE.MeshStandardMaterial({ color: 0xe5dcd0, roughness: 0.38, metalness: 0.08 });
    const louverMat = new THREE.MeshStandardMaterial({ color: 0x47423d, roughness: 0.5 });

    // Two 4-Way Commercial Ceiling Cassette AC Units along Central Aisle
    [-2.8, 2.8].forEach(cx => {
      const cassetteGroup = new THREE.Group();
      cassetteGroup.position.set(cx, 3.82, 2.2);

      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 1.15), acHousingMat);
      cassetteGroup.add(panel);

      // Center Return Air Grille
      const centerGrille = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.068, 0.56), louverMat);
      cassetteGroup.add(centerGrille);

      // 4 Perimeter Directional Air Supply Vents
      [
        [0, 0.42, 0.72, 0.08],
        [0, -0.42, 0.72, 0.08],
        [0.42, 0, 0.08, 0.72],
        [-0.42, 0, 0.08, 0.72]
      ].forEach(([vx, vz, vw, vd]) => {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(vw, 0.072, vd), louverMat);
        vent.position.set(vx, 0, vz);
        cassetteGroup.add(vent);
      });

      // Green Active Cooling Status LED
      const acLed = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
      acLed.position.set(0.46, -0.032, 0.46);
      cassetteGroup.add(acLed);

      scene.add(cassetteGroup);
    });

    // Continuous Architectural Linear Slot Diffuser above Kiosk Bay
    const linearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.04, 0.22), louverMat);
    linearDiffuser.position.set(0, 3.83, 0.55);
    scene.add(linearDiffuser);

    // Digital Wall HVAC Thermostat Controller on Right Wall
    const thermoBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.12), acHousingMat);
    thermoBox.position.set(7.76, 1.48, 3.6);
    const thermoScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.11), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    thermoScreen.position.set(7.738, 1.48, 3.6);
    thermoScreen.rotation.y = -Math.PI / 2;
    scene.add(thermoBox, thermoScreen);
  }

  /* -------------------------------------------------------------
     Vertical Acoustic Oak Louver Partitions Between Kiosk Pods
  ------------------------------------------------------------- */
  function buildPrivacyLouvers(oakWoodTex) {
    const slatMat = new THREE.MeshStandardMaterial({ map: oakWoodTex, roughness: 0.48 });
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0xdfd5c7, roughness: 0.45 });
    const dividerXPositions = [-6.1, -3.1, 0.0, 3.1, 6.1];

    dividerXPositions.forEach(dx => {
      const partitionGroup = new THREE.Group();
      partitionGroup.position.set(dx, 0, -0.35);

      const baseRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 1.45), plinthMat);
      baseRail.position.y = 0.06;
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 1.45), plinthMat);
      topRail.position.y = 3.78;
      partitionGroup.add(baseRail, topRail);

      for (let s = -0.62; s <= 0.62; s += 0.14) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.64, 0.08), slatMat);
        slat.position.set(0, 1.94, s);
        slat.castShadow = true;
        slat.receiveShadow = true;
        partitionGroup.add(slat);
      }

      scene.add(partitionGroup);
    });
  }

  /* -------------------------------------------------------------
     Branded Automatic Sliding Glass Entrance Doors & Motion Sensor
  ------------------------------------------------------------- */
  function buildEntranceGlassDoors() {
    const frontZ = 5.6;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.22 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.1
    });
    const decalTex = createFrostedGlassDecalTexture();
    const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide });

    // Side Fixed Glass Curtain Walls (Left & Right of Sliding Door Opening)
    [-4.85, 4.85].forEach(sx => {
      const fixedGlass = new THREE.Mesh(new THREE.BoxGeometry(5.9, 2.75, 0.04), glassMat);
      fixedGlass.position.set(sx, 1.38, frontZ);
      const topFrame = new THREE.Mesh(new THREE.BoxGeometry(5.95, 0.08, 0.12), frameMat);
      topFrame.position.set(sx, 2.76, frontZ);
      const botFrame = new THREE.Mesh(new THREE.BoxGeometry(5.95, 0.08, 0.12), frameMat);
      botFrame.position.set(sx, 0.04, frontZ);
      scene.add(fixedGlass, topFrame, botFrame);
    });

    // Overhead Transom Glass & Motorized Track Header Housing
    const headerHousing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.24, 0.24), frameMat);
    headerHousing.position.set(0, 2.84, frontZ);
    const transomGlass = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.88, 0.04), glassMat);
    transomGlass.position.set(0, 3.4, frontZ);
    scene.add(headerHousing, transomGlass);

    // Ultrasonic / Microwave Motion Sensor Box + LED Indicator (Interior & Exterior)
    doorSensorLedMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    [-0.14, 0.14].forEach(sz => {
      const sensorBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.07, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
      );
      sensorBody.position.set(0, 2.94, frontZ + sz);
      const sensorLed = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.012), doorSensorLedMat);
      sensorLed.position.set(0, 2.94, frontZ + sz + (sz > 0 ? 0.036 : -0.036));
      scene.add(sensorBody, sensorLed);
    });

    // Subtle Floor Sensor Activation Zone Grid
    const sensorZoneFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.4),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.09 })
    );
    sensorZoneFloor.rotation.x = -Math.PI / 2;
    sensorZoneFloor.position.set(0, 0.005, frontZ);
    scene.add(sensorZoneFloor);

    // Left & Right Sliding Glass Door Panels
    const buildDoorLeaf = (initialX, handleOffsetX) => {
      const leafGroup = new THREE.Group();
      leafGroup.position.set(initialX, 1.36, frontZ);

      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.68, 0.035), glassMat);
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.06, 0.07), frameMat);
      topRail.position.y = 1.32;
      const botRail = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 0.07), frameMat);
      botRail.position.y = -1.30;

      // Frosted CSC / Aadhaar Branding Band
      const decalPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.08), decalMat);
      decalPlane.position.z = 0.02;

      // Vertical Stainless Steel Pull Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.65, 12), frameMat);
      handle.position.set(handleOffsetX, -0.15, 0.05);

      leafGroup.add(pane, topRail, botRail, decalPlane, handle);
      scene.add(leafGroup);
      return leafGroup;
    };

    doorLeftMesh = buildDoorLeaf(-0.56, 0.44);
    doorRightMesh = buildDoorLeaf(0.56, -0.44);
  }

  /* -------------------------------------------------------------
     Outdoor Urban Plaza Backdrop (Visible Beyond Sliding Glass Doors)
  ------------------------------------------------------------- */
  function buildOutdoorBackdrop() {
    const sidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 10),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 })
    );
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(0, -0.01, 10.6);
    scene.add(sidewalk);

    const bollardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
    [-3.2, -1.6, 1.6, 3.2].forEach(bx => {
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.85, 16), bollardMat);
      bollard.position.set(bx, 0.425, 7.2);
      const capLight = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.06, 16), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      capLight.position.set(bx, 0.78, 7.2);
      scene.add(bollard, capLight);
    });

    const backdropCanvas = document.createElement('canvas');
    backdropCanvas.width = 1024;
    backdropCanvas.height = 512;
    const ctx = backdropCanvas.getContext('2d');
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 512);

    for (let b = 0; b < 14; b++) {
      const bw = 55 + (b % 3) * 20;
      const bh = 180 + (b % 4) * 55;
      const bx = b * 75 + 10;
      const by = 512 - bh;
      ctx.fillStyle = '#090d16';
      ctx.fillRect(bx, by, bw, bh);
      for (let wy = by + 16; wy < 490; wy += 24) {
        for (let wx = bx + 10; wx < bx + bw - 14; wx += 18) {
          ctx.fillStyle = (wx + wy) % 3 === 0 ? 'rgba(253, 224, 71, 0.45)' : 'rgba(147, 197, 253, 0.25)';
          ctx.fillRect(wx, wy, 10, 12);
        }
      }
    }
    const bgTex = new THREE.CanvasTexture(backdropCanvas);
    const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(26, 10), new THREE.MeshBasicMaterial({ map: bgTex }));
    bgPlane.position.set(0, 4.2, 15.2);
    bgPlane.rotation.y = Math.PI;
    scene.add(bgPlane);
  }

  /* -------------------------------------------------------------
     Vestibule Props: Queue Board, Waiting Seating, Water Dispenser, Fire Extinguisher, Bins
  ------------------------------------------------------------- */
  function buildVestibuleProps() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });

    // 1. Live Digital Queue & Token LED Board
    tokenDisplayCanvas = document.createElement('canvas');
    tokenDisplayCanvas.width = 512;
    tokenDisplayCanvas.height = 192;
    tokenDisplayTexture = new THREE.CanvasTexture(tokenDisplayCanvas);
    updateQueueBoardCanvas();

    const boardFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.68, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 })
    );
    boardFrame.position.set(0, 3.38, -1.08);
    const boardScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.65, 0.58),
      new THREE.MeshBasicMaterial({ map: tokenDisplayTexture })
    );
    boardScreen.position.set(0, 3.38, -1.028);
    scene.add(boardFrame, boardScreen);

    // 2. Stainless steel receipt bins next to kiosks
    const binXCoords = [-4.6, -1.6, 1.6, 4.6];
    binXCoords.forEach(bx => {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.68, 20), metalMat);
      bin.position.set(bx + 0.58, 0.34, -0.58);
      bin.castShadow = true;
      const binRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.015, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0x1e293b })
      );
      binRim.rotation.x = Math.PI / 2;
      binRim.position.set(bx + 0.58, 0.68, -0.58);
      scene.add(bin, binRim);
    });

    // 3. Citizen Waiting Chair Bench
    const benchGroup = new THREE.Group();
    benchGroup.position.set(-5.4, 0, 2.8);
    benchGroup.rotation.y = Math.PI / 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 0.08), metalMat);
    beam.position.y = 0.42;
    benchGroup.add(beam);

    [-1.1, 1.1].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.46), metalMat);
      leg.position.set(lx, 0.21, 0);
      benchGroup.add(leg);
    });

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38 });
    [-0.9, -0.3, 0.3, 0.9].forEach(sx => {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.44), seatMat);
      seat.position.set(sx, 0.46, 0);
      seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.05), seatMat);
      back.position.set(sx, 0.68, -0.2);
      back.castShadow = true;
      benchGroup.add(seat, back);
    });
    scene.add(benchGroup);

    // 4. Water Dispenser & Red Fire Extinguisher near Entrance
    const dispenserBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.95, 0.38),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    dispenserBody.position.set(6.4, 0.475, 4.8);
    const waterBottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.44, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x0284c7, transparent: true, opacity: 0.65, roughness: 0.1 })
    );
    waterBottle.position.set(6.4, 1.17, 4.8);
    scene.add(dispenserBody, waterBottle);

    const extBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.55, 16),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.4 })
    );
    extBody.position.set(5.9, 0.275, 4.9);
    scene.add(extBody);

    // 5. Ceiling Security CCTV Dome Cameras
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    [-3.5, 3.5].forEach(cx => {
      const cctvBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), domeMat);
      cctvBase.position.set(cx, 3.83, 2.5);
      const cctvGlass = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x020617 }));
      cctvGlass.position.set(cx, 3.81, 2.5);
      scene.add(cctvBase, cctvGlass);
    });

    // 6. Biophilic Potted Corner Plants
    [-7.2, 7.2].forEach(px => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      pot.position.set(px, 0.3, 4.5);
      pot.castShadow = true;
      scene.add(pot);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55 });
      for (let l = 0; l < 10; l++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 6), leafMat);
        leaf.rotation.x = 0.45 * Math.cos(l * 0.8);
        leaf.rotation.z = 0.45 * Math.sin(l * 0.8);
        leaf.position.set(px + Math.cos(l) * 0.09, 0.82, 4.5 + Math.sin(l) * 0.09);
        scene.add(leaf);
      }
    });
  }

  function updateQueueBoardCanvas() {
    if (!tokenDisplayCanvas) return;
    const ctx = tokenDisplayCanvas.getContext('2d');
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 192);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 184);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NOW SERVING TOKEN', 165, 45);
    ctx.fillText('POD STATION', 395, 45);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 88px "JetBrains Mono", monospace';
    ctx.fillText(`A-${currentTokenNumber}`, 165, 145);

    ctx.fillStyle = '#10b981';
    ctx.fillText(`0${(currentTokenNumber % 4) + 1}`, 395, 145);

    if (tokenDisplayTexture) tokenDisplayTexture.needsUpdate = true;
  }

  /* -------------------------------------------------------------
     Realistic 1:1 Scale Articulated Human Citizens (1.62m - 1.75m)
  ------------------------------------------------------------- */
  function createHumanPerson({ x, z, rotY, height = 1.70, skinColor = 0xc68642, shirtColor = 0x2563eb, pantsColor = 0x1e293b, pose = 'standing' }) {
    const person = new THREE.Group();
    person.position.set(x, 0, z);
    person.rotation.y = rotY;
    const scale = height / 1.70;
    person.scale.set(scale, scale, scale);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.55 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.65 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });

    if (pose === 'sitting') {
      const hipY = 0.50;
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.52, 16), shirtMat);
      torso.position.set(0, hipY + 0.28, 0);
      torso.castShadow = true;
      person.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 18), skinMat);
      head.position.set(0, hipY + 0.66, 0.02);
      head.castShadow = true;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.114, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
      hair.position.set(0, hipY + 0.67, 0.01);
      person.add(head, hair);

      [-0.085, 0.085].forEach(lx => {
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.40, 12), pantsMat);
        thigh.rotation.x = Math.PI / 2;
        thigh.position.set(lx, hipY + 0.02, 0.18);
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.44, 12), pantsMat);
        shin.position.set(lx, 0.26, 0.36);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.20), shoeMat);
        shoe.position.set(lx, 0.03, 0.40);
        person.add(thigh, shin, shoe);
      });

      [-0.18, 0.18].forEach((ax, idx) => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.44, 12), shirtMat);
        arm.rotation.x = -0.55;
        arm.rotation.z = idx === 0 ? -0.15 : 0.15;
        arm.position.set(ax * 0.85, hipY + 0.26, 0.14);
        person.add(arm);
      });

      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 0.13), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      phone.position.set(0, hipY + 0.12, 0.28);
      person.add(phone);

      person.userData = { pose, phase: Math.random() * Math.PI * 2 };
      return person;
    }

    // Standing / Interacting / Walking Pose
    const legs = [];
    [-0.09, 0.09].forEach((lx, lIdx) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(lx, 0.86, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.052, 0.86, 14), pantsMat);
      leg.position.set(0, -0.41, 0);
      leg.castShadow = true;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.065, 0.22), shoeMat);
      shoe.position.set(0, -0.83, 0.04);
      legGroup.add(leg, shoe);
      person.add(legGroup);
      legs.push(legGroup);
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.135, 0.56, 18), shirtMat);
    torso.position.set(0, 1.14, 0);
    torso.castShadow = true;
    person.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.09, 12), skinMat);
    neck.position.set(0, 1.45, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.112, 20, 20), skinMat);
    head.position.set(0, 1.56, 0.01);
    head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.116, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
    hair.position.set(0, 1.57, 0.0);
    person.add(neck, head, hair);

    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.52, 12), shirtMat);
    leftUpperArm.position.set(-0.20, 1.13, 0);
    leftUpperArm.rotation.z = 0.08;
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), skinMat);
    leftHand.position.set(-0.22, 0.86, 0.02);
    person.add(leftUpperArm, leftHand);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.20, 1.36, 0);
    if (pose === 'touching') {
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.28, 12), shirtMat);
      upperArm.rotation.x = -0.65;
      upperArm.position.set(0, -0.11, 0.09);
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.27, 12), skinMat);
      forearm.rotation.x = -1.25;
      forearm.position.set(-0.04, -0.19, 0.29);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), skinMat);
      hand.position.set(-0.06, -0.15, 0.42);
      rightArmGroup.add(upperArm, forearm, hand);
    } else {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.52, 12), shirtMat);
      arm.position.set(0, -0.24, 0);
      arm.rotation.z = -0.08;
      rightArmGroup.add(arm);
    }
    person.add(rightArmGroup);

    person.userData = { 
      rightArmGroup, 
      leftUpperArm,
      arms: [leftUpperArm, rightArmGroup],
      legs: legs,
      pose, 
      speed: config.speed || 0.8,
      path: config.path || null,
      targetIndex: 0,
      phase: Math.random() * Math.PI * 2 
    };
    return person;
  }

  function buildHumanCharacters() {
    // 4 Kiosks: X = [-4.6, -1.6, 1.6, 4.6] at Z = -0.6
    // Humans stand at Z ~ 0.22 facing kiosk (rotY = Math.PI)
    // 3 Kiosks actively occupied by citizens, 1 kiosk (Pod 02: x = -1.6) completely empty for the user!

    // Kiosk 1 Occupant: Citizen updating address & interacting with screen
    const user1 = createHumanPerson({
      x: -4.6,
      z: 0.16,
      rotY: Math.PI,
      height: 1.72,
      skinColor: 0xc68642,
      shirtColor: 0x0284c7, // Indian postal blue
      pantsColor: 0x1e293b,
      pose: 'touching',
      speed: 0
    });
    scene.add(user1);
    humanCharacters.push(user1);

    // KIOSK 2 (x = -1.6) IS LEFT EMPTY FOR THE USER TO WALK UP AND INTERACT!

    // Kiosk 3 Occupant: Citizen performing biometric fingerprint authentication
    const user3 = createHumanPerson({
      x: 1.6,
      z: 0.18,
      rotY: Math.PI,
      height: 1.66,
      skinColor: 0xd99b66,
      shirtColor: 0x059669, // Emerald green kurta
      pantsColor: 0xf1f5f9,
      pose: 'touching',
      speed: 0
    });
    scene.add(user3);
    humanCharacters.push(user3);

    // Kiosk 4 Occupant: Senior citizen completing Aadhaar PVC reprint
    const user4 = createHumanPerson({
      x: 4.6,
      z: 0.17,
      rotY: Math.PI,
      height: 1.68,
      skinColor: 0xb87333,
      shirtColor: 0xd97706, // Amber/Saffron shirt
      pantsColor: 0x334155,
      pose: 'touching',
      speed: 0
    });
    scene.add(user4);
    humanCharacters.push(user4);

    // Waiting Bench Citizen checking mobile phone
    const waiter = createHumanPerson({
      x: -5.2,
      z: 2.5,
      rotY: Math.PI / 2,
      height: 1.74,
      skinColor: 0xb87333,
      shirtColor: 0x475569,
      pantsColor: 0x0f172a,
      pose: 'sitting',
      speed: 0
    });
    scene.add(waiter);
    humanCharacters.push(waiter);

    // UIDAI Vestibule Security / Helpdesk Officer standing at side
    const assistant = createHumanPerson({
      x: 5.5,
      z: 2.4,
      rotY: -Math.PI * 0.72,
      height: 1.78,
      skinColor: 0xc68642,
      shirtColor: 0x1e3a8a, // Uniform navy blue
      pantsColor: 0x0f172a,
      pose: 'standing',
      speed: 0
    });
    scene.add(assistant);
    humanCharacters.push(assistant);

    // Dynamic Walking Citizen 1: Walking across vestibule from entrance to seating area
    const walker1 = createHumanPerson({
      x: -2.0,
      z: 4.8,
      rotY: 0,
      height: 1.70,
      skinColor: 0xc68642,
      shirtColor: 0x9333ea, // Purple shirt
      pantsColor: 0x1e293b,
      pose: 'walking',
      speed: 0.85,
      path: [
        { x: -1.2, z: 4.6 },
        { x: -3.8, z: 2.8 },
        { x: -4.2, z: 1.8 },
        { x: -2.5, z: 2.8 },
        { x: -0.5, z: 4.8 }
      ]
    });
    scene.add(walker1);
    humanCharacters.push(walker1);

    // Dynamic Walking Citizen 2: Walking after service completion toward the sliding glass doors
    const walker2 = createHumanPerson({
      x: 3.2,
      z: 1.6,
      rotY: 0,
      height: 1.65,
      skinColor: 0xd99b66,
      shirtColor: 0xe11d48, // Rose red top
      pantsColor: 0x0f172a,
      pose: 'walking',
      speed: 0.72,
      path: [
        { x: 3.4, z: 1.5 },
        { x: 1.8, z: 3.2 },
        { x: 0.0, z: 5.4 },
        { x: 2.2, z: 3.2 }
      ]
    });
    scene.add(walker2);
    humanCharacters.push(walker2);
  }

  /* -------------------------------------------------------------
     Aadhaar Multi-Pod Kiosk Hardware Assembly ("2. LEAN TOWER")
     - Overall Height: 1800 mm (1.80 m) | Width: 500 mm (0.50 m) | Depth: 650 mm (0.65 m)
     - Slim vertical tower form with protruding angled document shelf at 900 mm
     - Camera 1600mm, Iris 1550mm, Screen 1400mm, Fingerprint 1050mm, Doc Scanner 900mm
  ------------------------------------------------------------- */
  function createAadhaarHeaderTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);

    ctx.fillStyle = '#f59e0b';
    for (let i = -3; i <= 3; i++) {
      const ang = -Math.PI / 2 + i * 0.34;
      const rx = 128 + Math.cos(ang) * 44;
      const ry = 66 + Math.sin(ang) * 44;
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 4;
    [14, 22, 30].forEach(r => {
      ctx.beginPath();
      ctx.arc(128, 68, r, Math.PI, 0);
      ctx.stroke();
    });

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AADHAAR', 128, 108);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  function buildKioskStations() {
    const podXPositions = [-4.6, -1.6, 1.6, 4.6];

    // Load and parse Kiosk.obj geometry using OBJLoader
    const objLoader = new THREE.OBJLoader();
    let kioskBaseModel = null;

    if (window.KIOSK_OBJ_TEXT) {
      try {
        kioskBaseModel = objLoader.parse(window.KIOSK_OBJ_TEXT);
      } catch (err) {
        console.error("Error parsing KIOSK_OBJ_TEXT:", err);
      }
    }

    // Material definitions for Kiosk.obj
    const kioskBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.2,
      roughness: 0.35
    });

    const kioskDarkAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.45,
      roughness: 0.3
    });

    podXPositions.forEach((xPos, idx) => {
      const podGroup = new THREE.Group();
      podGroup.position.set(xPos, 0, -0.6);

      // 1. Overhead Crimson ATM Canopy with Illuminated Ring
      const canopyGroup = new THREE.Group();
      canopyGroup.position.set(0, 3.1, 0);

      const canopyGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.42, 24, 1, false, 0, Math.PI);
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.3, metalness: 0.2 });
      const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
      canopyMesh.rotation.y = -Math.PI / 2;
      canopyGroup.add(canopyMesh);

      const ringGeo = new THREE.TorusGeometry(0.86, 0.025, 12, 32, Math.PI);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.rotation.z = -Math.PI / 2;
      ringMesh.position.y = -0.21;
      canopyGroup.add(ringMesh);

      const bladeGeo = new THREE.BoxGeometry(0.04, 0.5, 0.35);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2 });
      const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
      bladeMesh.position.set(0.72, -0.1, 0.2);
      canopyGroup.add(bladeMesh);

      podGroup.add(canopyGroup);

      // 2. Kiosk.obj 3D Model Instance
      if (kioskBaseModel) {
        const kioskClone = kioskBaseModel.clone(true);
        // Correct orientation:
        // In OBJ, front screen normal has negative Y (-0.82) and height is Z [0, 170cm].
        // rotation.x = -Math.PI/2 maps Z_obj -> +Y (Up) and -Y_obj -> +Z (Facing forward into the room towards the user)
        kioskClone.rotation.x = -Math.PI / 2;
        kioskClone.rotation.y = 0;
        kioskClone.rotation.z = 0;
        kioskClone.scale.set(0.01, 0.01, 0.01);
        kioskClone.position.set(0, 0, 0);

        kioskClone.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = kioskBodyMaterial;
          }
        });

        podGroup.add(kioskClone);
      }

      // Base Pedestal Plinth
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.46, 0.04, 32),
        kioskDarkAccentMaterial
      );
      plinth.position.set(0, 0.02, 0);
      plinth.receiveShadow = true;
      podGroup.add(plinth);

      // 3. Interactive Touchscreen & Display Surface
      const screenObj = createKioskScreenTexture(idx + 1, 0);
      const screenGeo = new THREE.PlaneGeometry(0.53, 0.41);
      const screenMat = new THREE.MeshBasicMaterial({ 
        map: screenObj.texture,
        transparent: false,
        side: THREE.DoubleSide
      });
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      // Screen face in +Z orientation: Y=1.265m, Z=0.018m, tilted back ~17 degrees
      screenMesh.position.set(0.005, 1.265, 0.018);
      screenMesh.rotation.x = -0.296;
      screenMesh.userData = {
        podIndex: idx + 1,
        activeStep: 0,
        screenObj: screenObj
      };
      podGroup.add(screenMesh);
      interactiveScreens.push(screenMesh);

      // Screen Bezel border
      const bezelGeo = new THREE.BoxGeometry(0.55, 0.43, 0.015);
      const bezelMesh = new THREE.Mesh(bezelGeo, kioskDarkAccentMaterial);
      bezelMesh.position.set(0.005, 1.265, 0.012);
      bezelMesh.rotation.x = -0.296;
      podGroup.add(bezelMesh);

      // Ambient Biometric Scanner Glow LED strip underneath screen
      const scannerGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.38, 0.018),
        new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
      );
      scannerGlow.position.set(0.005, 0.94, 0.145);
      scannerGlow.rotation.x = -0.55;
      podGroup.add(scannerGlow);

      scene.add(podGroup);
      kioskGroupList.push(podGroup);
    });
  }

  /* -------------------------------------------------------------
     Input Handling & Physics Movement
  ------------------------------------------------------------- */
  function setupEventHandlers() {
    window.addEventListener('resize', onWindowResize);

    window.addEventListener('keydown', (e) => handleKey(e.code, true));
    window.addEventListener('keyup', (e) => handleKey(e.code, false));

    function handleKey(code, isPressed) {
      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          player.keys.forward = isPressed;
          toggleKeyUI('key-w', isPressed);
          break;
        case 'KeyS':
        case 'ArrowDown':
          player.keys.backward = isPressed;
          toggleKeyUI('key-s', isPressed);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          player.keys.left = isPressed;
          toggleKeyUI('key-a', isPressed);
          break;
        case 'KeyD':
        case 'ArrowRight':
          player.keys.right = isPressed;
          toggleKeyUI('key-d', isPressed);
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          player.keys.sprint = isPressed;
          break;
      }
    }

    function toggleKeyUI(id, active) {
      const el = document.getElementById(id);
      if (el) {
        active ? el.classList.add('active') : el.classList.remove('active');
      }
    }

    const bindTouch = (btnId, keyName) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); player.keys[keyName] = true; });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); player.keys[keyName] = false; });
      btn.addEventListener('mousedown', () => { player.keys[keyName] = true; });
      btn.addEventListener('mouseup', () => { player.keys[keyName] = false; });
    };

    bindTouch('touch-up', 'forward');
    bindTouch('touch-down', 'backward');
    bindTouch('touch-left', 'left');
    bindTouch('touch-right', 'right');

    const raycaster = new THREE.Raycaster();
    const mouseCoord = new THREE.Vector2();

    container.addEventListener('mousedown', (e) => {
      mouseCoord.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseCoord.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouseCoord, camera);

      const intersects = raycaster.intersectObjects(interactiveScreens);
      if (intersects.length > 0) {
        onScreenClicked(intersects[0].object);
        return;
      }

      if (isWalkMode) {
        player.isDragging = true;
        player.dragStart.x = e.clientX;
        player.dragStart.y = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      player.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (isWalkMode && player.isDragging) {
        const deltaX = e.clientX - player.dragStart.x;
        const deltaY = e.clientY - player.dragStart.y;
        player.dragStart.x = e.clientX;
        player.dragStart.y = e.clientY;

        const sensitivity = 0.0035;
        player.targetYaw -= deltaX * sensitivity;
        player.targetPitch -= deltaY * sensitivity;
        player.targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, player.targetPitch));
      }
    });

    let touchLookStart = { x: 0, y: 0 };
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchLookStart.x = e.touches[0].clientX;
        touchLookStart.y = e.touches[0].clientY;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isWalkMode) {
        const deltaX = e.touches[0].clientX - touchLookStart.x;
        const deltaY = e.touches[0].clientY - touchLookStart.y;
        touchLookStart.x = e.touches[0].clientX;
        touchLookStart.y = e.touches[0].clientY;

        const sensitivity = 0.004;
        player.targetYaw -= deltaX * sensitivity;
        player.targetPitch -= deltaY * sensitivity;
        player.targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, player.targetPitch));
      }
    }, { passive: true });

    const toggleWalkBtn = document.getElementById('btn-toggle-walk');
    toggleWalkBtn.addEventListener('click', () => {
      isWalkMode = !isWalkMode;
      orbitControls.enabled = !isWalkMode;
      const walkText = document.getElementById('walk-mode-text');
      const crosshair = document.getElementById('crosshair');

      if (isWalkMode) {
        walkText.textContent = 'Walk Inside (Active)';
        toggleWalkBtn.classList.replace('bg-slate-800', 'bg-emerald-600');
        crosshair.classList.remove('opacity-0');
        player.position.copy(camera.position);
        player.position.y = 1.65;
        player.targetYaw = camera.rotation.y;
        player.yaw = camera.rotation.y;
      } else {
        walkText.textContent = 'Orbit View Mode';
        toggleWalkBtn.classList.replace('bg-emerald-600', 'bg-slate-800');
        crosshair.classList.add('opacity-0');
        orbitControls.target.set(0, 1.4, 0);
      }
    });

    document.querySelectorAll('.cam-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const camKey = e.currentTarget.getAttribute('data-cam');
        setCameraPreset(camKey);
      });
    });

    const doorBtn = document.getElementById('btn-door-toggle');
    doorBtn.addEventListener('click', () => {
      if (doorForcedMode === 'auto') {
        doorForcedMode = 'open';
        document.getElementById('door-btn-text').textContent = 'Door: Forced Open';
      } else if (doorForcedMode === 'open') {
        doorForcedMode = 'closed';
        document.getElementById('door-btn-text').textContent = 'Door: Forced Closed';
      } else {
        doorForcedMode = 'auto';
        document.getElementById('door-btn-text').textContent = 'Door: Auto Sensor';
      }
      AudioEngine.playBeep(600, 0.05);
    });

    document.getElementById('btn-light-toggle').addEventListener('click', () => {
      isNightLighting = !isNightLighting;
      ambientLight.intensity = isNightLighting ? 0.58 : 0.92;
      mainSpotlights.forEach(spot => spot.intensity = isNightLighting ? 1.15 : 0.72);
      AudioEngine.playBeep(520, 0.05);
    });

    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  }

  /* -------------------------------------------------------------
     Screen Click & Interactive Modal
  ------------------------------------------------------------- */
  function onScreenClicked(mesh) {
    AudioEngine.playBeep(980, 0.08);
    currentTokenNumber++;
    updateQueueBoardCanvas();

    mesh.userData.activeStep = (mesh.userData.activeStep + 1) % 3;
    const newScreenObj = createKioskScreenTexture(mesh.userData.podIndex, mesh.userData.activeStep);
    mesh.material.map = newScreenObj.texture;
    mesh.material.needsUpdate = true;
    mesh.userData.screenObj = newScreenObj;

    openKioskModal(mesh.userData.podIndex, newScreenObj.currentStep);
  }

  function openKioskModal(podId, stepData) {
    const modal = document.getElementById('kiosk-modal');
    document.getElementById('modal-pod-id').textContent = `TERMINAL POD 0${podId} • ONLINE`;
    document.getElementById('modal-title').textContent = stepData.title;

    const contentDiv = document.getElementById('modal-screen-content');
    contentDiv.innerHTML = `
      <div>
        <p class="text-xs text-slate-400 mb-3">${stepData.sub}</p>
        <div class="space-y-2">
          ${stepData.cards.map((c, i) => `
            <div class="p-3 rounded-xl ${i === 0 ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200' : 'bg-slate-900 border border-white/10 text-slate-300'} flex items-center justify-between text-xs font-semibold">
              <span>${c}</span>
              <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <span><i class="fa-solid fa-shield-halved text-emerald-400 mr-1"></i>256-Bit Encrypted Session</span>
        <span>Time remaining: 01:58</span>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeModal() {
    const modal = document.getElementById('kiosk-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  /* -------------------------------------------------------------
     Camera Preset Positioning
  ------------------------------------------------------------- */
  function setCameraPreset(key) {
    isWalkMode = false;
    orbitControls.enabled = true;
    document.getElementById('walk-mode-text').textContent = 'Orbit View Mode';
    document.getElementById('btn-toggle-walk').classList.replace('bg-emerald-600', 'bg-slate-800');
    document.getElementById('crosshair').classList.add('opacity-0');

    let targetPos, targetLook;
    if (key === 'entrance') {
      targetPos = new THREE.Vector3(0, 1.65, 7.6);
      targetLook = new THREE.Vector3(0, 1.65, 3.0);
    } else if (key === 'pod1') {
      targetPos = new THREE.Vector3(-4.6, 1.4, 0.95);
      targetLook = new THREE.Vector3(-4.6, 1.35, -0.6);
    } else if (key === 'top') {
      targetPos = new THREE.Vector3(0, 8.5, 1.5);
      targetLook = new THREE.Vector3(0, 0, 1.5);
    } else {
      targetPos = new THREE.Vector3(0, 2.2, 5.0);
      targetLook = new THREE.Vector3(0, 1.4, 0);
    }

    new TWEEN.Tween(camera.position)
      .to(targetPos, 900)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();

    new TWEEN.Tween(orbitControls.target)
      .to(targetLook, 900)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
  }

  /* -------------------------------------------------------------
     WebXR VR Setup
  ------------------------------------------------------------- */
  function setupVR() {
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          const vrBtn = document.createElement('button');
          vrBtn.id = 'VRButton';
          vrBtn.innerHTML = '<i class="fa-solid fa-vr-cardboard mr-2"></i>Enter VR Mode';
          vrBtn.addEventListener('click', () => {
            navigator.xr.requestSession('immersive-vr', {
              optionalFeatures: ['local-floor', 'bounded-floor']
            }).then((session) => {
              renderer.xr.setSession(session);
            });
          });
          document.body.appendChild(vrBtn);
        }
      });
    }
  }

  /* -------------------------------------------------------------
     Continuous Physics Update & Strafe Calculation
  ------------------------------------------------------------- */
  function updatePhysics(delta) {
    if (!isWalkMode) return;

    player.yaw += (player.targetYaw - player.yaw) * 0.25;
    player.pitch += (player.targetPitch - player.pitch) * 0.25;

    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);

    const moveDir = new THREE.Vector3(0, 0, 0);

    if (player.keys.forward) moveDir.add(forward);
    if (player.keys.backward) moveDir.sub(forward);
    if (player.keys.left) moveDir.sub(right);
    if (player.keys.right) moveDir.add(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const currentSpeed = player.speed * (player.keys.sprint ? player.sprintMultiplier : 1.0);
      player.velocity.copy(moveDir.multiplyScalar(currentSpeed));
    } else {
      player.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.18);
    }

    player.position.addScaledVector(player.velocity, delta);

    // Boundary containment
    player.position.x = Math.max(-7.3, Math.min(7.3, player.position.x));
    player.position.z = Math.max(0.15, Math.min(7.8, player.position.z));
    player.position.y = 1.65;

    camera.position.copy(player.position);
  }

  /* -------------------------------------------------------------
     Door Motion Sensor & Sliding Animation
  ------------------------------------------------------------- */
  function updateAutomaticDoors(delta) {
    if (!doorLeftMesh || !doorRightMesh) return;

    const frontWallZ = 5.6;
    let shouldOpen = false;

    if (doorForcedMode === 'open') {
      shouldOpen = true;
    } else if (doorForcedMode === 'closed') {
      shouldOpen = false;
    } else {
      const distZ = Math.abs(player.position.z - frontWallZ);
      const distX = Math.abs(player.position.x);
      if (distZ < 2.4 && distX < 2.0) {
        shouldOpen = true;
      }
    }

    if (shouldOpen !== previousDoorAudibleState) {
      AudioEngine.playDoorChime(shouldOpen);
      previousDoorAudibleState = shouldOpen;
    }

    if (doorSensorLedMat) {
      doorSensorLedMat.color.setHex(shouldOpen ? 0x10b981 : 0x38bdf8);
    }

    doorTargetPercent = shouldOpen ? 1.0 : 0.0;
    doorOpenPercent += (doorTargetPercent - doorOpenPercent) * (delta * 4.5);

    const closedLX = -0.56;
    const openLX = -1.68;
    const closedRX = 0.56;
    const openRX = 1.68;

    doorLeftMesh.position.x = closedLX + (openLX - closedLX) * doorOpenPercent;
    doorRightMesh.position.x = closedRX + (openRX - closedRX) * doorOpenPercent;
  }

  /* -------------------------------------------------------------
     Subtle Human Breathing & Touchscreen Interaction Animation
  ------------------------------------------------------------- */
  function updateHumanAnimations(elapsed) {
    humanCharacters.forEach(person => {
      const ud = person.userData;
      if (!ud) return;

      // Kiosk interaction tapping animation
      if (ud.pose === 'touching' && ud.rightArmGroup) {
        // Natural tapping cycle: periodic tap motion with slight breathing
        const tapCycle = Math.sin(elapsed * 1.8 + ud.phase);
        ud.rightArmGroup.rotation.x = -0.55 + Math.max(0, tapCycle) * 0.18;
        person.position.y = Math.sin(elapsed * 1.2 + ud.phase) * 0.003; // Subtle breathing sway
      }

      // Sitting person checking phone
      if (ud.pose === 'sitting') {
        person.rotation.y = (Math.PI / 2) + Math.sin(elapsed * 0.8) * 0.04;
      }

      // Dynamic walking characters along waypoints
      if (ud.pose === 'walking' && ud.path && ud.path.length > 0) {
        if (ud.targetIndex === undefined) ud.targetIndex = 0;
        const target = ud.path[ud.targetIndex];
        const dx = target.x - person.position.x;
        const dz = target.z - person.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.25) {
          ud.targetIndex = (ud.targetIndex + 1) % ud.path.length;
        } else {
          const moveDist = 0.016 * (ud.speed || 0.8);
          person.position.x += (dx / dist) * moveDist;
          person.position.z += (dz / dist) * moveDist;

          // Face movement direction
          const targetAngle = Math.atan2(dx, dz);
          person.rotation.y = targetAngle;

          // Leg & arm stride swing
          const swing = Math.sin(elapsed * 6.5 * (ud.speed || 0.8));
          person.position.y = Math.abs(Math.sin(elapsed * 6.5)) * 0.02; // Vertical walking bounce
          if (ud.legs) {
            ud.legs[0].rotation.x = swing * 0.45;
            ud.legs[1].rotation.x = -swing * 0.45;
          }
          if (ud.arms) {
            ud.arms[0].rotation.x = -swing * 0.35;
            ud.arms[1].rotation.x = swing * 0.35;
          }
        }
      }
    });
  }

  /* -------------------------------------------------------------
     Window Resize & Initialization
  ------------------------------------------------------------- */
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function init() {
    container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.025);

    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.rotation.order = 'YXZ';
    camera.position.copy(player.position);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.06;
    orbitControls.enabled = false;

    // Warm Architectural Lighting & Natural Room Bounce
    ambientLight = new THREE.AmbientLight(0xfff5e8, 0.58);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfef3c7, 0x8c7b68, 0.62);
    scene.add(hemiLight);

    // Subtle Natural Daylight Fill Coming Through the Front Glass Entrance
    const entranceFillLight = new THREE.DirectionalLight(0xfff8eb, 0.45);
    entranceFillLight.position.set(0, 2.8, 8.5);
    entranceFillLight.target.position.set(0, 1.0, 0);
    scene.add(entranceFillLight, entranceFillLight.target);

    // Warm 3200K Overhead Spotlights Above Each Kiosk Bay
    [-4.6, -1.6, 1.6, 4.6].forEach(sx => {
      const spot = new THREE.SpotLight(0xffe8c8, 1.15, 9.5, Math.PI / 3.4, 0.55, 1.2);
      spot.position.set(sx, 3.6, 0.65);
      spot.target.position.set(sx, 0.9, -0.6);
      spot.castShadow = true;
      spot.shadow.bias = -0.0005;
      scene.add(spot, spot.target);
      mainSpotlights.push(spot);
    });

    buildBankArchitecture();
    buildKioskStations();
    setupEventHandlers();
    setupVR();

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      TWEEN.update();
      updatePhysics(delta);
      updateAutomaticDoors(delta);
      updateHumanAnimations(elapsed);

      if (!isWalkMode && orbitControls.enabled) {
        orbitControls.update();
      }

      renderer.render(scene, camera);
    });
  }

  window.onload = init;
