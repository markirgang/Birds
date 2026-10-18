/**
 * Animatronic Bird Show Master Web Application
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize 3D Visualizer (Safely wrapped)
    let visualizer = null;
    try {
        visualizer = new BirdShow3D('stage3dContainer');
        window.visualizer = visualizer;
    } catch (e) {
        console.warn("3D Visualizer initialization bypassed:", e);
    }

    // State object
    let localState = {
        ai_sync_mode: "turns",
        active_speaker: "parrot1",
        is_speaking: false,
        parrot1: {
            mouth_eyes_channel_a: "off",
            wings_channel_b: false,
            perch: { turn: 90, bow: 90, shimmy: 90 },
            spotlight: { pan: 90, tilt: 90, intensity: 100 }
        },
        parrot2: {
            mouth_eyes_channel_a: "off",
            wings_channel_b: false,
            perch: { turn: 90, bow: 90, shimmy: 90 },
            spotlight: { pan: 90, tilt: 90, intensity: 100 }
        },
        center_bird: { motor_moving: false, mouth_chirp: false, perch: { turn: 90, bow: 90, shimmy: 90 } },
        front_left_bird: { spotlight: true, moving: false, relay_chirp: false },
        front_right_bird: { spotlight: true, moving: false, relay_chirp: false },
        rear_left_bird: { spotlight: true, moving: false },
        rear_right_bird: { spotlight: true, moving: false },
        main_base: { servo_angle: 90, random_moving: true }
    };

    // --- 2. PROMINENT 3-POSITION AI SPEECH SYNC SLIDE SWITCH ---
    const switchOptions = document.querySelectorAll('.switch-option');
    const switchThumb = document.getElementById('switchThumb');
    const activeSpeakerText = document.getElementById('activeSpeakerText');

    function updateSyncSwitchUI(mode) {
        switchOptions.forEach((opt, idx) => {
            const val = opt.getAttribute('data-value');
            if (val === mode) {
                opt.classList.add('active');
                opt.querySelector('input').checked = true;
                if (switchThumb) {
                    switchThumb.style.transform = `translateX(${idx * 100}%)`;
                }
            } else {
                opt.classList.remove('active');
            }
        });

        if (activeSpeakerText) {
            if (mode === "parrot1") activeSpeakerText.textContent = "PARROT 1 (LEFT)";
            else if (mode === "parrot2") activeSpeakerText.textContent = "PARROT 2 (RIGHT)";
            else activeSpeakerText.textContent = "TAKE TURNS (ALTERNATING)";
        }
    }

    switchOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const val = opt.getAttribute('data-value');
            localState.ai_sync_mode = val;
            updateSyncSwitchUI(val);

            fetch('/api/birds/sync_mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: val })
            });
        });
    });

    // --- 3. HARDWARE CONTROL EVENT LISTENERS ---

    // Helper for POST requests
    function sendPost(endpoint, data) {
        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }

    // Parrot 1 L298 Buttons
    const btnP1Mouth = document.getElementById('btnP1Mouth');
    const btnP1Eyes = document.getElementById('btnP1Eyes');
    const btnP1Off = document.getElementById('btnP1Off');
    const btnP1Wings = document.getElementById('btnP1Wings');

    function setP1L298UI(mode) {
        if (btnP1Mouth) btnP1Mouth.classList.toggle('active', mode === 'mouth_open');
        if (btnP1Eyes) btnP1Eyes.classList.toggle('active', mode === 'eyes_blink');
        if (btnP1Off) btnP1Off.classList.toggle('active', mode === 'off');
    }

    if (btnP1Mouth) {
        btnP1Mouth.addEventListener('click', () => {
            localState.parrot1.mouth_eyes_channel_a = 'mouth_open';
            setP1L298UI('mouth_open');
            sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'mouth_open' });
        });
    }

    if (btnP1Eyes) {
        btnP1Eyes.addEventListener('click', () => {
            localState.parrot1.mouth_eyes_channel_a = 'eyes_blink';
            setP1L298UI('eyes_blink');
            sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'eyes_blink' });
        });
    }

    if (btnP1Off) {
        btnP1Off.addEventListener('click', () => {
            localState.parrot1.mouth_eyes_channel_a = 'off';
            setP1L298UI('off');
            sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'off' });
        });
    }

    if (btnP1Wings) {
        btnP1Wings.addEventListener('click', () => {
            localState.parrot1.wings_channel_b = !localState.parrot1.wings_channel_b;
            btnP1Wings.classList.toggle('active', localState.parrot1.wings_channel_b);
            sendPost('/api/birds/parrot', { parrot: 'parrot1', wings: localState.parrot1.wings_channel_b });
        });
    }

    // Parrot 2 L298 Buttons
    const btnP2Mouth = document.getElementById('btnP2Mouth');
    const btnP2Eyes = document.getElementById('btnP2Eyes');
    const btnP2Off = document.getElementById('btnP2Off');
    const btnP2Wings = document.getElementById('btnP2Wings');

    function setP2L298UI(mode) {
        if (btnP2Mouth) btnP2Mouth.classList.toggle('active', mode === 'mouth_open');
        if (btnP2Eyes) btnP2Eyes.classList.toggle('active', mode === 'eyes_blink');
        if (btnP2Off) btnP2Off.classList.toggle('active', mode === 'off');
    }

    if (btnP2Mouth) {
        btnP2Mouth.addEventListener('click', () => {
            localState.parrot2.mouth_eyes_channel_a = 'mouth_open';
            setP2L298UI('mouth_open');
            sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'mouth_open' });
        });
    }

    if (btnP2Eyes) {
        btnP2Eyes.addEventListener('click', () => {
            localState.parrot2.mouth_eyes_channel_a = 'eyes_blink';
            setP2L298UI('eyes_blink');
            sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'eyes_blink' });
        });
    }

    if (btnP2Off) {
        btnP2Off.addEventListener('click', () => {
            localState.parrot2.mouth_eyes_channel_a = 'off';
            setP2L298UI('off');
            sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'off' });
        });
    }

    if (btnP2Wings) {
        btnP2Wings.addEventListener('click', () => {
            localState.parrot2.wings_channel_b = !localState.parrot2.wings_channel_b;
            btnP2Wings.classList.toggle('active', localState.parrot2.wings_channel_b);
            sendPost('/api/birds/parrot', { parrot: 'parrot2', wings: localState.parrot2.wings_channel_b });
        });
    }

    // 3-DOF Perch & Spotlight Sliders
    function setupRange(id, valId, callback) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(valId);
        if (!el) return;
        el.addEventListener('input', (e) => {
            const v = e.target.value;
            if (valEl) valEl.textContent = v + (id.includes('Int') ? '%' : '°');
            callback(parseInt(v));
        });
    }

    // Parrot 1 Perch & Spot Sliders
    setupRange('p1Turn', 'p1TurnVal', v => sendPost('/api/birds/perch', { parrot: 'parrot1', turn: v }));
    setupRange('p1Bow', 'p1BowVal', v => sendPost('/api/birds/perch', { parrot: 'parrot1', bow: v }));
    setupRange('p1Shimmy', 'p1ShimmyVal', v => sendPost('/api/birds/perch', { parrot: 'parrot1', shimmy: v }));

    setupRange('p1SpotPan', 'p1SpotPanVal', v => sendPost('/api/birds/spotlight', { spotlight: 'parrot1', pan: v }));
    setupRange('p1SpotTilt', 'p1SpotTiltVal', v => sendPost('/api/birds/spotlight', { spotlight: 'parrot1', tilt: v }));
    setupRange('p1SpotInt', 'p1SpotIntVal', v => sendPost('/api/birds/spotlight', { spotlight: 'parrot1', intensity: v }));

    // Parrot 2 Perch & Spot Sliders
    setupRange('p2Turn', 'p2TurnVal', v => sendPost('/api/birds/perch', { parrot: 'parrot2', turn: v }));
    setupRange('p2Bow', 'p2BowVal', v => sendPost('/api/birds/perch', { parrot: 'parrot2', bow: v }));
    setupRange('p2Shimmy', 'p2ShimmyVal', v => sendPost('/api/birds/perch', { parrot: 'parrot2', shimmy: v }));

    setupRange('p2SpotPan', 'p2SpotPanVal', v => sendPost('/api/birds/spotlight', { spotlight: 'parrot2', pan: v }));
    setupRange('p2SpotTilt', 'p2SpotTiltVal', v => sendPost('/api/birds/spotlight', { spotlight: 'parrot2', tilt: v }));
    setupRange('p2SpotInt', 'p2SpotIntVal', v => sendPost('/api/birds/spotlight', { spotlight: 'parrot2', intensity: v }));

    // --- CIRCULAR MOTION & 2-DOF / 3-DOF TEST CONTROLLERS ---
    const circleMotionIntervals = {
        p1Perch: null,
        p2Perch: null,
        centerPerch: null,
        p1Spot: null,
        p2Spot: null
    };

    function updateP1PerchUI(turn, bow, shimmy) {
        sendPost('/api/birds/perch', { parrot: 'parrot1', turn, bow, shimmy });
        const tInput = document.getElementById('p1Turn'), bInput = document.getElementById('p1Bow'), sInput = document.getElementById('p1Shimmy');
        const tVal = document.getElementById('p1TurnVal'), bVal = document.getElementById('p1BowVal'), sVal = document.getElementById('p1ShimmyVal');
        if (tInput) tInput.value = turn;
        if (bInput) bInput.value = bow;
        if (sInput) sInput.value = shimmy;
        if (tVal) tVal.textContent = turn + '°';
        if (bVal) bVal.textContent = bow + '°';
        if (sVal) sVal.textContent = shimmy + '°';
    }

    function updateP2PerchUI(turn, bow, shimmy) {
        sendPost('/api/birds/perch', { parrot: 'parrot2', turn, bow, shimmy });
        const tInput = document.getElementById('p2Turn'), bInput = document.getElementById('p2Bow'), sInput = document.getElementById('p2Shimmy');
        const tVal = document.getElementById('p2TurnVal'), bVal = document.getElementById('p2BowVal'), sVal = document.getElementById('p2ShimmyVal');
        if (tInput) tInput.value = turn;
        if (bInput) bInput.value = bow;
        if (sInput) sInput.value = shimmy;
        if (tVal) tVal.textContent = turn + '°';
        if (bVal) bVal.textContent = bow + '°';
        if (sVal) sVal.textContent = shimmy + '°';
    }

    function updateCenterPerchUI(turn, bow, shimmy) {
        sendPost('/api/birds/small_birds', { center: { perch: { turn, bow, shimmy } } });
        const tInput = document.getElementById('centerTurn'), bInput = document.getElementById('centerBow'), sInput = document.getElementById('centerShimmy');
        const tVal = document.getElementById('centerTurnVal'), bVal = document.getElementById('centerBowVal'), sVal = document.getElementById('centerShimmyVal');
        if (tInput) tInput.value = turn;
        if (bInput) bInput.value = bow;
        if (sInput) sInput.value = shimmy;
        if (tVal) tVal.textContent = turn + '°';
        if (bVal) bVal.textContent = bow + '°';
        if (sVal) sVal.textContent = shimmy + '°';
    }

    function togglePerchCircle(key, updateFn, buttonIds) {
        const buttons = buttonIds.map(id => document.getElementById(id)).filter(Boolean);
        if (circleMotionIntervals[key]) {
            clearInterval(circleMotionIntervals[key]);
            circleMotionIntervals[key] = null;
            buttons.forEach(btn => btn.classList.remove('active'));
            updateFn(90, 90, 90);
            if (typeof logDiag === 'function') logDiag(`⏹ Stopped 3D circular motion loop for ${key}.`);
        } else {
            buttons.forEach(btn => btn.classList.add('active'));
            let angle = 0;
            circleMotionIntervals[key] = setInterval(() => {
                angle += 0.12;
                const turn = Math.round(90 + Math.sin(angle) * 35);
                const bow = Math.round(90 + Math.cos(angle) * 25);
                const shimmy = Math.round(90 + Math.sin(angle * 0.8) * 20);
                updateFn(turn, bow, shimmy);
            }, 50);
            if (typeof logDiag === 'function') logDiag(`🔄 Started 3D circular motion loop for ${key}.`);
        }
    }

    function toggleSpotlightCircle(spotId, key, buttonIds) {
        const buttons = buttonIds.map(id => document.getElementById(id)).filter(Boolean);
        const panInput = document.getElementById((spotId === 'parrot1') ? 'p1SpotPan' : 'p2SpotPan');
        const tiltInput = document.getElementById((spotId === 'parrot1') ? 'p1SpotTilt' : 'p2SpotTilt');
        const panVal = document.getElementById((spotId === 'parrot1') ? 'p1SpotPanVal' : 'p2SpotPanVal');
        const tiltVal = document.getElementById((spotId === 'parrot1') ? 'p1SpotTiltVal' : 'p2SpotTiltVal');

        if (circleMotionIntervals[key]) {
            clearInterval(circleMotionIntervals[key]);
            circleMotionIntervals[key] = null;
            buttons.forEach(btn => btn.classList.remove('active'));
            sendPost('/api/birds/spotlight', { spotlight: spotId, pan: 90, tilt: 90 });
            if (panInput) panInput.value = 90;
            if (tiltInput) tiltInput.value = 90;
            if (panVal) panVal.textContent = '90°';
            if (tiltVal) tiltVal.textContent = '90°';
            if (typeof logDiag === 'function') logDiag(`⏹ Stopped 2-DOF spotlight circle loop for ${spotId}.`);
        } else {
            buttons.forEach(btn => btn.classList.add('active'));
            let angle = 0;
            circleMotionIntervals[key] = setInterval(() => {
                angle += 0.15;
                const pan = Math.round(90 + Math.sin(angle) * 35);
                const tilt = Math.round(90 + Math.cos(angle) * 30);
                sendPost('/api/birds/spotlight', { spotlight: spotId, pan, tilt });
                if (panInput) panInput.value = pan;
                if (tiltInput) tiltInput.value = tilt;
                if (panVal) panVal.textContent = pan + '°';
                if (tiltVal) tiltVal.textContent = tilt + '°';
            }, 50);
            if (typeof logDiag === 'function') logDiag(`🔄 Started 2-DOF spotlight circle orbit for ${spotId}.`);
        }
    }

    function runSpotlightPanTiltSweep(spotId) {
        let step = 0;
        const panInput = document.getElementById((spotId === 'parrot1') ? 'p1SpotPan' : 'p2SpotPan');
        const tiltInput = document.getElementById((spotId === 'parrot1') ? 'p1SpotTilt' : 'p2SpotTilt');
        const panVal = document.getElementById((spotId === 'parrot1') ? 'p1SpotPanVal' : 'p2SpotPanVal');
        const tiltVal = document.getElementById((spotId === 'parrot1') ? 'p1SpotTiltVal' : 'p2SpotTiltVal');

        if (typeof logDiag === 'function') logDiag(`↕️ Running 2-DOF Spotlight sweep for ${spotId}...`);
        const sweepInterval = setInterval(() => {
            step++;
            const pan = Math.round(90 + Math.sin(step * 0.2) * 45);
            const tilt = Math.round(90 + Math.cos(step * 0.2) * 35);
            sendPost('/api/birds/spotlight', { spotlight: spotId, pan, tilt });
            if (panInput) panInput.value = pan;
            if (tiltInput) tiltInput.value = tilt;
            if (panVal) panVal.textContent = pan + '°';
            if (tiltVal) tiltVal.textContent = tilt + '°';

            if (step >= 31) {
                clearInterval(sweepInterval);
                sendPost('/api/birds/spotlight', { spotlight: spotId, pan: 90, tilt: 90 });
                if (panInput) panInput.value = 90;
                if (tiltInput) tiltInput.value = 90;
                if (panVal) panVal.textContent = '90°';
                if (tiltVal) tiltVal.textContent = '90°';
            }
        }, 60);
    }

    // Connect Parrot 1 & Parrot 2 & Center Circle and Sweep Buttons
    ['btnP1Circle', 'btnTestP1Circle'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => togglePerchCircle('p1Perch', updateP1PerchUI, ['btnP1Circle', 'btnTestP1Circle']));
    });

    ['btnP2Circle', 'btnTestP2Circle'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => togglePerchCircle('p2Perch', updateP2PerchUI, ['btnP2Circle', 'btnTestP2Circle']));
    });

    ['btnCenterCircle', 'btnTestCenterCircle'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => togglePerchCircle('centerPerch', updateCenterPerchUI, ['btnCenterCircle', 'btnTestCenterCircle']));
    });

    ['btnP1SpotCircle', 'btnTestSpot1Circle'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => toggleSpotlightCircle('parrot1', 'p1Spot', ['btnP1SpotCircle', 'btnTestSpot1Circle']));
    });

    ['btnP2SpotCircle', 'btnTestSpot2Circle'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => toggleSpotlightCircle('parrot2', 'p2Spot', ['btnP2SpotCircle', 'btnTestSpot2Circle']));
    });

    ['btnP1SpotSweep', 'btnTestSpot1Sweep'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => runSpotlightPanTiltSweep('parrot1'));
    });

    ['btnP2SpotSweep', 'btnTestSpot2Sweep'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => runSpotlightPanTiltSweep('parrot2'));
    });

    const btnP1SweepPerch = document.getElementById('btnP1SweepPerch');
    if (btnP1SweepPerch) {
        btnP1SweepPerch.addEventListener('click', () => {
            let step = 0;
            const sweepInterval = setInterval(() => {
                step++;
                const turn = Math.round(90 + Math.sin(step * 0.2) * 45);
                const bow = Math.round(90 + Math.cos(step * 0.2) * 30);
                const shimmy = Math.round(90 + Math.sin(step * 0.3) * 25);
                updateP1PerchUI(turn, bow, shimmy);
                if (step >= 31) {
                    clearInterval(sweepInterval);
                    updateP1PerchUI(90, 90, 90);
                }
            }, 60);
        });
    }

    const btnP2SweepPerch = document.getElementById('btnP2SweepPerch');
    if (btnP2SweepPerch) {
        btnP2SweepPerch.addEventListener('click', () => {
            let step = 0;
            const sweepInterval = setInterval(() => {
                step++;
                const turn = Math.round(90 + Math.sin(step * 0.2) * 45);
                const bow = Math.round(90 + Math.cos(step * 0.2) * 30);
                const shimmy = Math.round(90 + Math.sin(step * 0.3) * 25);
                updateP2PerchUI(turn, bow, shimmy);
                if (step >= 31) {
                    clearInterval(sweepInterval);
                    updateP2PerchUI(90, 90, 90);
                }
            }, 60);
        });
    }

    // Center Small Bird 3-DOF Perch Sliders & Preset Buttons
    setupRange('centerTurn', 'centerTurnVal', v => sendPost('/api/birds/small_birds', { center: { perch: { turn: v } } }));
    setupRange('centerBow', 'centerBowVal', v => sendPost('/api/birds/small_birds', { center: { perch: { bow: v } } }));
    setupRange('centerShimmy', 'centerShimmyVal', v => sendPost('/api/birds/small_birds', { center: { perch: { shimmy: v } } }));

    document.querySelectorAll('.btn-preset-turn').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = parseInt(btn.getAttribute('data-val'));
            const slider = document.getElementById('centerTurn');
            const valEl = document.getElementById('centerTurnVal');
            if (slider) slider.value = v;
            if (valEl) valEl.textContent = v + '°';
            sendPost('/api/birds/small_birds', { center: { perch: { turn: v } } });
        });
    });

    document.querySelectorAll('.btn-preset-bow').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = parseInt(btn.getAttribute('data-val'));
            const slider = document.getElementById('centerBow');
            const valEl = document.getElementById('centerBowVal');
            if (slider) slider.value = v;
            if (valEl) valEl.textContent = v + '°';
            sendPost('/api/birds/small_birds', { center: { perch: { bow: v } } });
        });
    });

    document.querySelectorAll('.btn-preset-shimmy').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = parseInt(btn.getAttribute('data-val'));
            const slider = document.getElementById('centerShimmy');
            const valEl = document.getElementById('centerShimmyVal');
            if (slider) slider.value = v;
            if (valEl) valEl.textContent = v + '°';
            sendPost('/api/birds/small_birds', { center: { perch: { shimmy: v } } });
        });
    });

    // 3-DOF Perch Sweep Button
    const btnCenterSweepPerch = document.getElementById('btnCenterSweepPerch');
    if (btnCenterSweepPerch) {
        btnCenterSweepPerch.addEventListener('click', () => {
            let step = 0;
            const sweepInterval = setInterval(() => {
                step++;
                const turnAngle = 90 + Math.floor(Math.sin(step * 0.2) * 50);
                const bowAngle = 90 + Math.floor(Math.cos(step * 0.2) * 35);
                const shimmyAngle = 90 + Math.floor(Math.sin(step * 0.3) * 35);

                const tSlider = document.getElementById('centerTurn');
                const bSlider = document.getElementById('centerBow');
                const sSlider = document.getElementById('centerShimmy');
                if (tSlider) { tSlider.value = turnAngle; const vEl = document.getElementById('centerTurnVal'); if (vEl) vEl.textContent = turnAngle + '°'; }
                if (bSlider) { bSlider.value = bowAngle; const vEl = document.getElementById('centerBowVal'); if (vEl) vEl.textContent = bowAngle + '°'; }
                if (sSlider) { sSlider.value = shimmyAngle; const vEl = document.getElementById('centerShimmyVal'); if (vEl) vEl.textContent = shimmyAngle + '°'; }

                sendPost('/api/birds/small_birds', { center: { perch: { turn: turnAngle, bow: bowAngle, shimmy: shimmyAngle } } });

                if (step >= 30) clearInterval(sweepInterval);
            }, 100);
        });
    }

    // Small Birds Controls
    const btnCenterMotor = document.getElementById('btnCenterMotor');
    const btnCenterChirpPulse = document.getElementById('btnCenterChirpPulse');

    if (btnCenterMotor) {
        btnCenterMotor.addEventListener('click', () => {
            localState.center_bird.motor_moving = !localState.center_bird.motor_moving;
            btnCenterMotor.classList.toggle('active', localState.center_bird.motor_moving);
            sendPost('/api/birds/small_birds', { center: { motor_moving: localState.center_bird.motor_moving } });
        });
    }

    if (btnCenterChirpPulse) {
        btnCenterChirpPulse.addEventListener('click', () => {
            sendPost('/api/birds/small_birds', { center: { mouth_chirp: true, motor_moving: true } });
            btnCenterChirpPulse.classList.add('active');
            setTimeout(() => {
                sendPost('/api/birds/small_birds', { center: { mouth_chirp: false, motor_moving: false } });
                btnCenterChirpPulse.classList.remove('active');
            }, 1200);
        });
    }

    // Front Left Small Bird
    const btnFrontLeftSpot = document.getElementById('btnFrontLeftSpot');
    const btnFrontLeftRelay = document.getElementById('btnFrontLeftRelay');
    const btnFrontLeftMotor = document.getElementById('btnFrontLeftMotor');

    if (btnFrontLeftSpot) {
        btnFrontLeftSpot.addEventListener('click', () => {
            if (!localState.front_left_bird) localState.front_left_bird = { spotlight: true };
            localState.front_left_bird.spotlight = !localState.front_left_bird.spotlight;
            btnFrontLeftSpot.classList.toggle('active', localState.front_left_bird.spotlight);
            sendPost('/api/birds/small_birds', { front_left: { spotlight: localState.front_left_bird.spotlight } });
        });
    }

    if (btnFrontLeftRelay) {
        btnFrontLeftRelay.addEventListener('click', () => {
            if (!localState.front_left_bird) localState.front_left_bird = { relay_chirp: false };
            localState.front_left_bird.relay_chirp = !localState.front_left_bird.relay_chirp;
            btnFrontLeftRelay.classList.toggle('active', localState.front_left_bird.relay_chirp);
            sendPost('/api/birds/small_birds', { front_left: { relay_chirp: localState.front_left_bird.relay_chirp } });
        });
    }

    if (btnFrontLeftMotor) {
        btnFrontLeftMotor.addEventListener('click', () => {
            if (!localState.front_left_bird) localState.front_left_bird = { moving: false };
            localState.front_left_bird.moving = !localState.front_left_bird.moving;
            btnFrontLeftMotor.classList.toggle('active', localState.front_left_bird.moving);
            sendPost('/api/birds/small_birds', { front_left: { moving: localState.front_left_bird.moving } });
        });
    }

    // Front Right Small Bird
    const btnFrontRightSpot = document.getElementById('btnFrontRightSpot');
    const btnFrontRightRelay = document.getElementById('btnFrontRightRelay');
    const btnFrontRightMotor = document.getElementById('btnFrontRightMotor');

    if (btnFrontRightSpot) {
        btnFrontRightSpot.addEventListener('click', () => {
            if (!localState.front_right_bird) localState.front_right_bird = { spotlight: true };
            localState.front_right_bird.spotlight = !localState.front_right_bird.spotlight;
            btnFrontRightSpot.classList.toggle('active', localState.front_right_bird.spotlight);
            sendPost('/api/birds/small_birds', { front_right: { spotlight: localState.front_right_bird.spotlight } });
        });
    }

    if (btnFrontRightRelay) {
        btnFrontRightRelay.addEventListener('click', () => {
            if (!localState.front_right_bird) localState.front_right_bird = { relay_chirp: false };
            localState.front_right_bird.relay_chirp = !localState.front_right_bird.relay_chirp;
            btnFrontRightRelay.classList.toggle('active', localState.front_right_bird.relay_chirp);
            sendPost('/api/birds/small_birds', { front_right: { relay_chirp: localState.front_right_bird.relay_chirp } });
        });
    }

    if (btnFrontRightMotor) {
        btnFrontRightMotor.addEventListener('click', () => {
            if (!localState.front_right_bird) localState.front_right_bird = { moving: false };
            localState.front_right_bird.moving = !localState.front_right_bird.moving;
            btnFrontRightMotor.classList.toggle('active', localState.front_right_bird.moving);
            sendPost('/api/birds/small_birds', { front_right: { moving: localState.front_right_bird.moving } });
        });
    }

    // Rear Left Small Bird
    const btnRearLeftSpot = document.getElementById('btnRearLeftSpot');
    const btnRearLeftMotor = document.getElementById('btnRearLeftMotor');

    if (btnRearLeftSpot) {
        btnRearLeftSpot.addEventListener('click', () => {
            if (!localState.rear_left_bird) localState.rear_left_bird = { spotlight: true };
            localState.rear_left_bird.spotlight = !localState.rear_left_bird.spotlight;
            btnRearLeftSpot.classList.toggle('active', localState.rear_left_bird.spotlight);
            sendPost('/api/birds/small_birds', { rear_left: { spotlight: localState.rear_left_bird.spotlight } });
        });
    }

    if (btnRearLeftMotor) {
        btnRearLeftMotor.addEventListener('click', () => {
            if (!localState.rear_left_bird) localState.rear_left_bird = { moving: false };
            localState.rear_left_bird.moving = !localState.rear_left_bird.moving;
            btnRearLeftMotor.classList.toggle('active', localState.rear_left_bird.moving);
            sendPost('/api/birds/small_birds', { rear_left: { moving: localState.rear_left_bird.moving } });
        });
    }

    // Rear Right Small Bird
    const btnRearRightSpot = document.getElementById('btnRearRightSpot');
    const btnRearRightMotor = document.getElementById('btnRearRightMotor');

    if (btnRearRightSpot) {
        btnRearRightSpot.addEventListener('click', () => {
            if (!localState.rear_right_bird) localState.rear_right_bird = { spotlight: true };
            localState.rear_right_bird.spotlight = !localState.rear_right_bird.spotlight;
            btnRearRightSpot.classList.toggle('active', localState.rear_right_bird.spotlight);
            sendPost('/api/birds/small_birds', { rear_right: { spotlight: localState.rear_right_bird.spotlight } });
        });
    }

    if (btnRearRightMotor) {
        btnRearRightMotor.addEventListener('click', () => {
            if (!localState.rear_right_bird) localState.rear_right_bird = { moving: false };
            localState.rear_right_bird.moving = !localState.rear_right_bird.moving;
            btnRearRightMotor.classList.toggle('active', localState.rear_right_bird.moving);
            sendPost('/api/birds/small_birds', { rear_right: { moving: localState.rear_right_bird.moving } });
        });
    }

    // Main Stage Base Servo
    setupRange('baseAngle', 'baseAngleVal', v => sendPost('/api/birds/main_base', { angle: v }));
    const btnBaseRandom = document.getElementById('btnBaseRandom');
    const baseAngleSlider = document.getElementById('baseAngle');
    const baseAngleVal = document.getElementById('baseAngleVal');

    function updateBaseRandomBtnUI(isMoving) {
        if (!btnBaseRandom) return;
        btnBaseRandom.classList.toggle('active', isMoving);
        btnBaseRandom.textContent = isMoving ? "🎲 Slow Random Rotation ON" : "🛑 Random Rotation OFF";
    }

    if (btnBaseRandom) {
        btnBaseRandom.addEventListener('click', () => {
            localState.main_base.random_moving = !localState.main_base.random_moving;
            updateBaseRandomBtnUI(localState.main_base.random_moving);
            sendPost('/api/birds/main_base', { random_moving: localState.main_base.random_moving });
        });
    }

    // --- 4. AI CHAT, SPEECH SYNTHESIZER & AUDIO SYNC ---
    const aiPromptInput = document.getElementById('aiPromptInput');
    const btnSendChat = document.getElementById('btnSendChat');
    const aiResponseBox = document.getElementById('aiResponseBox');

    function speakTextAndSyncParrot(text, parrotId) {
        if (!text) return;
        aiResponseBox.innerHTML = `<strong>🦜 AI PARROT PERFORMANCE:</strong> ${text}`;

        const speaker = parrotId || localState.active_speaker || 'parrot1';
        let voice = (speaker === 'parrot2') ? p2Voice : p1Voice;

        const audioUrl = `/api/tts/speak?text=${encodeURIComponent(text)}&parrot=${encodeURIComponent(speaker)}&voice=${encodeURIComponent(voice)}`;
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'off' });
            sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'off' });

            // Automatically restart microphone in continuous hands-free mode when AI finishes speaking
            if (continuousMicMode) {
                aiResponseBox.innerHTML += `<br><em>AI finished speaking! Re-arming mic for your response...</em>`;
                setTimeout(() => {
                    if (continuousMicMode && !isRecordingMic) {
                        startMicRecording();
                    }
                }, 500);
            }
        };

        // Web Audio API for Amplitude Detection
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaElementSource(audio);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyser.connect(audioCtx.destination);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            let syncInterval = setInterval(() => {
                if (audio.paused || audio.ended) {
                    clearInterval(syncInterval);
                    sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'off' });
                    sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'off' });
                    return;
                }

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                let average = sum / bufferLength;

                // Sync active parrot mouth based on audio volume
                const speaker = localState.active_speaker || 'parrot1';
                const isLoud = average > 25;

                if (speaker === 'parrot1') {
                    sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: isLoud ? 'mouth_open' : 'off' });
                    sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'off' });
                } else {
                    sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: isLoud ? 'mouth_open' : 'off' });
                    sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'off' });
                }
            }, 80);

        } catch (e) {
            console.log("Audio API init fallback:", e);
        }

        audio.play().catch(e => console.log("Audio play error:", e));
    }

    function sendChat() {
        const text = aiPromptInput.value.trim();
        if (!text) return;

        aiResponseBox.textContent = "Thinking & preparing bird performance...";
        fetch('/api/gemini/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text })
        })
        .then(r => r.json())
        .then(data => {
            aiPromptInput.value = '';
            if (data.text) {
                speakTextAndSyncParrot(data.text);
            }
        })
        .catch(err => {
            aiResponseBox.textContent = "Error communicating with AI.";
        });
    }

    if (btnSendChat) btnSendChat.addEventListener('click', sendChat);
    if (aiPromptInput) aiPromptInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendChat(); });

    // Download Python Script Button
    const btnExportCode = document.getElementById('btnExportCode');
    if (btnExportCode) {
        btnExportCode.addEventListener('click', () => {
            window.location.href = '/api/export-python';
        });
    }

    // Camera Source Selector & Switch / Reset Buttons
    const camSourceSelect = document.getElementById('camSourceSelect');
    const configCamSource = document.getElementById('configCamSource');
    const btnSwitchCam = document.getElementById('btnSwitchCam');
    const btnResetCam = document.getElementById('btnResetCam');
    const btnConfigSwitchCam = document.getElementById('btnConfigSwitchCam');
    const btnConfigResetCam = document.getElementById('btnConfigResetCam');

    const cameraSources = ['usb', '1', 'csi', 'virtual'];

    function changeCameraSource(newSource) {
        if (camSourceSelect) camSourceSelect.value = newSource;
        if (configCamSource) configCamSource.value = newSource;
        sendPost('/api/camera/select', { source: newSource }, (data) => {
            if (data && data.success) {
                console.log('Camera source changed to:', newSource);
            }
        });
    }

    function resetCameraFeed() {
        sendPost('/api/camera/reset', {}, (data) => {
            console.log('Camera stream reset:', data);
            const feedEl = document.getElementById('camFeed');
            const previewEl = document.getElementById('configCamPreview');
            const t = Date.now();
            if (feedEl) feedEl.src = `/api/camera/frame?t=${t}`;
            if (previewEl) previewEl.src = `/api/camera/frame?t=${t}`;
        });
    }

    function cycleNextCamera() {
        const currentSrc = (camSourceSelect ? camSourceSelect.value : (configCamSource ? configCamSource.value : 'usb'));
        let idx = cameraSources.indexOf(currentSrc);
        if (idx === -1) idx = 0;
        const nextSrc = cameraSources[(idx + 1) % cameraSources.length];
        changeCameraSource(nextSrc);
    }

    if (camSourceSelect) {
        camSourceSelect.addEventListener('change', (e) => changeCameraSource(e.target.value));
    }
    if (configCamSource) {
        configCamSource.addEventListener('change', (e) => changeCameraSource(e.target.value));
    }

    if (btnSwitchCam) btnSwitchCam.addEventListener('click', cycleNextCamera);
    if (btnConfigSwitchCam) btnConfigSwitchCam.addEventListener('click', cycleNextCamera);

    if (btnResetCam) btnResetCam.addEventListener('click', resetCameraFeed);
    if (btnConfigResetCam) btnConfigResetCam.addEventListener('click', resetCameraFeed);

    // --- CONTINUOUS CAMERA STREAM REFRESH (NON-BLOCKING) ---
    const camFeedEl = document.getElementById('camFeed');
    let camLoading = false;
    function refreshCameraFrame() {
        if (!camFeedEl || camLoading) return;
        camLoading = true;
        const img = new Image();
        img.onload = () => {
            camFeedEl.src = img.src;
            camLoading = false;
            setTimeout(refreshCameraFrame, 1000);
        };
        img.onerror = () => {
            camLoading = false;
            setTimeout(refreshCameraFrame, 2000);
        };
        img.src = `/api/camera/frame?t=${Date.now()}`;
    }
    refreshCameraFrame();

    // --- MICROPHONE VOICE RECORDING & AUTOMATIC VOICE ACTIVITY DETECTION (VAD) ---
    const btnMicToggle = document.getElementById('btnMicToggle');
    const vuFill = document.getElementById('vuFill');
    const micSensitivitySlider = document.getElementById('micSensitivitySlider');
    const micSensitivityVal = document.getElementById('micSensitivityVal');

    if (micSensitivitySlider && micSensitivityVal) {
        micSensitivitySlider.addEventListener('input', (e) => {
            micSensitivityVal.textContent = e.target.value + '%';
        });
    }

    let isRecordingMic = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let micStream = null;
    let micAudioCtx = null;
    let micAnalyser = null;

    let speechDetected = false;
    let silenceStartTimestamp = null;
    const SILENCE_THRESHOLD_MS = 1400; // 1.4 seconds of silence auto-stops recording

    let continuousMicMode = false;

    function stopRecordingAndSend() {
        if (!isRecordingMic) return;
        isRecordingMic = false;
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
        }
        if (micAudioCtx) {
            micAudioCtx.close();
            micAudioCtx = null;
        }
        if (!continuousMicMode) {
            btnMicToggle.textContent = "🎙️ Start Hands-Free Voice";
            btnMicToggle.style.background = "";
        }
        if (vuFill) vuFill.style.width = '0%';
    }

    async function startMicRecording() {
        if (isRecordingMic) return;
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = micAudioCtx.createMediaStreamSource(micStream);
            micAnalyser = micAudioCtx.createAnalyser();
            micAnalyser.fftSize = 128;
            source.connect(micAnalyser);

            audioChunks = [];
            speechDetected = false;
            silenceStartTimestamp = null;

            mediaRecorder = new MediaRecorder(micStream);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const b64Data = reader.result.split(',')[1];
                    aiResponseBox.textContent = "Processing spoken words and sending to AI...";

                    fetch('/api/gemini/voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ audio_b64: b64Data, mime_type: 'audio/webm' })
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.text) {
                            speakTextAndSyncParrot(data.text);
                        } else if (continuousMicMode) {
                            setTimeout(() => { if (continuousMicMode && !isRecordingMic) startMicRecording(); }, 1000);
                        }
                    })
                    .catch(e => {
                        aiResponseBox.textContent = "Error processing voice command.";
                        if (continuousMicMode) {
                            setTimeout(() => { if (continuousMicMode && !isRecordingMic) startMicRecording(); }, 2000);
                        }
                    });
                };
                reader.readAsDataURL(audioBlob);
            };

            mediaRecorder.start();
            isRecordingMic = true;
            btnMicToggle.textContent = "⏹️ Hands-Free Active";
            btnMicToggle.style.background = "linear-gradient(135deg, #ff3344, #cc0022)";
            updateMicVuMeter();

        } catch (err) {
            alert("Microphone permission denied or microphone not found.");
            continuousMicMode = false;
            btnMicToggle.textContent = "🎙️ Start Hands-Free Voice";
            btnMicToggle.style.background = "";
        }
    }

    function updateMicVuMeter() {
        if (!isRecordingMic || !micAnalyser) {
            if (vuFill) vuFill.style.width = '0%';
            return;
        }

        const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
        micAnalyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        let avg = sum / dataArray.length;
        let pct = Math.min(100, Math.max(0, (avg / 100) * 100));

        if (vuFill) vuFill.style.width = pct + '%';

        // Read dynamic mic sensitivity slider threshold
        const speechThreshold = micSensitivitySlider ? parseInt(micSensitivitySlider.value) : 15;

        // Automatic Voice Activity Detection (Auto-Stop on Silence)
        if (pct > speechThreshold) {
            speechDetected = true;
            silenceStartTimestamp = null;
            btnMicToggle.textContent = "🎙️ Listening to you...";
        } else if (speechDetected) {
            if (!silenceStartTimestamp) {
                silenceStartTimestamp = Date.now();
            } else if (Date.now() - silenceStartTimestamp > SILENCE_THRESHOLD_MS) {
                aiResponseBox.textContent = "Processing your spoken words...";
                stopRecordingAndSend();
                return;
            }
        }

        requestAnimationFrame(updateMicVuMeter);
    }

    if (btnMicToggle) {
        btnMicToggle.addEventListener('click', () => {
            if (!continuousMicMode) {
                continuousMicMode = true;
                startMicRecording();
            } else {
                continuousMicMode = false;
                stopRecordingAndSend();
                btnMicToggle.textContent = "🎙️ Start Hands-Free Voice";
                btnMicToggle.style.background = "";
            }
        });
    }

    // --- MP3 SONG PLAYLIST & REAL-TIME WEB AUDIO LIPSYNC ENGINE ---
    const songSelect = document.getElementById('songSelect');
    const fileUploadInput = document.getElementById('fileUploadInput');
    const btnSongPlay = document.getElementById('btnSongPlay');
    const btnSongPause = document.getElementById('btnSongPause');
    const btnSongStop = document.getElementById('btnSongStop');
    const songProgressBar = document.getElementById('songProgressBar');
    const currTimeText = document.getElementById('currTimeText');
    const durTimeText = document.getElementById('durTimeText');
    const lipsyncGainSlider = document.getElementById('lipsyncGainSlider');
    const lipsyncGainVal = document.getElementById('lipsyncGainVal');
    const songVolumeSlider = document.getElementById('songVolumeSlider');
    const songVolumeVal = document.getElementById('songVolumeVal');
    const lipsyncBadge = document.getElementById('lipsyncBadge');

    let mp3Audio = new Audio();
    mp3Audio.crossOrigin = "anonymous";
    let audioCtx = null;
    let analyser = null;
    let audioSourceNode = null;
    let isLipsyncing = false;
    let phraseSpeakerToggleTimer = 0;

    function formatTime(sec) {
        if (isNaN(sec)) return "00:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function loadPlaylist() {
        fetch('/api/playlist')
            .then(r => r.json())
            .then(data => {
                if (!data.songs) return;
                songSelect.innerHTML = '<option value="">-- Choose Song --</option>';
                data.songs.forEach(song => {
                    const opt = document.createElement('option');
                    opt.value = song.url;
                    opt.textContent = song.title;
                    songSelect.appendChild(opt);
                });
            })
            .catch(e => console.log("Playlist load error:", e));
    }
    loadPlaylist();

    if (songSelect) {
        songSelect.addEventListener('change', () => {
            if (songSelect.value) {
                mp3Audio.src = songSelect.value;
                mp3Audio.load();
            }
        });
    }

    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const b64 = evt.target.result.split(',')[1];
                fetch('/api/playlist/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name, file_b64: b64 })
                })
                .then(r => r.json())
                .then(res => {
                    if (res.url) {
                        loadPlaylist();
                        setTimeout(() => {
                            if (songSelect) songSelect.value = res.url;
                            mp3Audio.src = res.url;
                            mp3Audio.play();
                            startMp3Lipsync();
                        }, 400);
                    }
                });
            };
            reader.readAsDataURL(file);
        });
    }

    function initWebAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            audioSourceNode = audioCtx.createMediaElementSource(mp3Audio);
            audioSourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function startMp3Lipsync() {
        initWebAudio();
        isLipsyncing = true;
        if (lipsyncBadge) lipsyncBadge.textContent = "🎶 LIPSYNCING ACTIVE";

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function analyzeLoop() {
            if (!isLipsyncing || mp3Audio.paused || mp3Audio.ended) {
                isLipsyncing = false;
                if (lipsyncBadge) lipsyncBadge.textContent = "🎶 Web Audio Lipsync Engine";
                sendPost('/api/playlist/lipsync_state', { is_singing: false, mouth_open: false, beat_pulse: false });
                return;
            }

            analyser.getByteFrequencyData(dataArray);

            let vocalSum = 0;
            for (let i = 10; i < 80; i++) vocalSum += dataArray[i];
            let vocalAvg = vocalSum / 70;

            let bassSum = 0;
            for (let i = 1; i < 8; i++) bassSum += dataArray[i];
            let bassAvg = bassSum / 7;

            const gainThresh = (parseInt(lipsyncGainSlider.value) / 100) * 120;
            const isMouthOpen = vocalAvg > (15 + gainThresh * 0.3);
            const isBeatPulse = bassAvg > 140;

            phraseSpeakerToggleTimer++;
            if (localState.ai_sync_mode === "turns" && phraseSpeakerToggleTimer % 180 === 0) {
                const current = localState.active_speaker;
                localState.active_speaker = (current === "parrot1") ? "parrot2" : "parrot1";
            }

            const speaker = (localState.ai_sync_mode === "turns") ? localState.active_speaker : localState.ai_sync_mode;

            sendPost('/api/playlist/lipsync_state', {
                speaker: speaker,
                is_singing: true,
                mouth_open: isMouthOpen,
                beat_pulse: isBeatPulse
            });

            if (speaker === "parrot1") {
                localState.parrot1.mouth_eyes_channel_a = isMouthOpen ? "mouth_open" : "off";
                if (isBeatPulse) localState.parrot1.wings_channel_b = true;
            } else if (speaker === "parrot2") {
                localState.parrot2.mouth_eyes_channel_a = isMouthOpen ? "mouth_open" : "off";
                if (isBeatPulse) localState.parrot2.wings_channel_b = true;
            }

            if (visualizer) visualizer.updateState(localState);

            requestAnimationFrame(analyzeLoop);
        }

        analyzeLoop();
    }

    if (btnSongPlay) {
        btnSongPlay.addEventListener('click', () => {
            if (!mp3Audio.src && songSelect && songSelect.value) {
                mp3Audio.src = songSelect.value;
            }
            if (mp3Audio.src) {
                mp3Audio.play();
                startMp3Lipsync();
            }
        });
    }

    if (btnSongPause) {
        btnSongPause.addEventListener('click', () => {
            mp3Audio.pause();
            isLipsyncing = false;
        });
    }

    if (btnSongStop) {
        btnSongStop.addEventListener('click', () => {
            mp3Audio.pause();
            mp3Audio.currentTime = 0;
            isLipsyncing = false;
        });
    }

    if (mp3Audio) {
        mp3Audio.addEventListener('timeupdate', () => {
            if (mp3Audio.duration) {
                const pct = (mp3Audio.currentTime / mp3Audio.duration) * 100;
                if (songProgressBar) songProgressBar.value = pct;
                if (currTimeText) currTimeText.textContent = formatTime(mp3Audio.currentTime);
                if (durTimeText) durTimeText.textContent = formatTime(mp3Audio.duration);
            }
        });
    }

    if (songProgressBar) {
        songProgressBar.addEventListener('input', (e) => {
            if (mp3Audio.duration) {
                mp3Audio.currentTime = (e.target.value / 100) * mp3Audio.duration;
            }
        });
    }

    if (songVolumeSlider) {
        songVolumeSlider.addEventListener('input', (e) => {
            const v = e.target.value;
            mp3Audio.volume = v / 100;
            if (songVolumeVal) songVolumeVal.textContent = v + '%';
        });
    }

    if (lipsyncGainSlider) {
        lipsyncGainSlider.addEventListener('input', (e) => {
            if (lipsyncGainVal) lipsyncGainVal.textContent = e.target.value + '%';
        });
    }

    // Status Check
    const systemStatusEl = document.getElementById('systemStatus');
    function checkStatus() {
        fetch('/api/status')
            .then(r => r.json())
            .then(d => {
                if (systemStatusEl) systemStatusEl.textContent = '🟢 ONLINE (Port 1290)';
            })
            .catch(() => {
                if (systemStatusEl) systemStatusEl.textContent = '🔴 OFFLINE';
            });
    }
    checkStatus();
    setInterval(checkStatus, 5000);

    // --- 5. STATE POLL & SYNC LOOP ---
    setInterval(() => {
        fetch('/api/birds/state')
            .then(r => r.json())
            .then(data => {
                localState = data;
                if (visualizer) visualizer.updateState(data);
                updateSyncSwitchUI(data.ai_sync_mode);
                const p1SelectEl = document.getElementById('p1VoiceSelect');
                const configP1SelectEl = document.getElementById('configP1VoiceSelect');
                if (data.parrot1 && data.parrot1.voice && document.activeElement !== p1SelectEl && document.activeElement !== configP1SelectEl) {
                    p1Voice = data.parrot1.voice;
                    if (p1SelectEl) p1SelectEl.value = p1Voice;
                    if (configP1SelectEl) configP1SelectEl.value = p1Voice;
                }

                const p2SelectEl = document.getElementById('p2VoiceSelect');
                const configP2SelectEl = document.getElementById('configP2VoiceSelect');
                if (data.parrot2 && data.parrot2.voice && document.activeElement !== p2SelectEl && document.activeElement !== configP2SelectEl) {
                    p2Voice = data.parrot2.voice;
                    if (p2SelectEl) p2SelectEl.value = p2Voice;
                    if (configP2SelectEl) configP2SelectEl.value = p2Voice;
                }
                if (data.center_bird) {
                    const btnCtrMotorEl = document.getElementById('btnCenterMotor');
                    if (btnCtrMotorEl) btnCtrMotorEl.classList.toggle('active', !!data.center_bird.motor_moving);
                    if (data.center_bird.perch) {
                        const cTurnSlider = document.getElementById('centerTurn');
                        const cTurnVal = document.getElementById('centerTurnVal');
                        if (cTurnSlider && document.activeElement !== cTurnSlider) {
                            cTurnSlider.value = data.center_bird.perch.turn;
                            if (cTurnVal) cTurnVal.textContent = data.center_bird.perch.turn + '°';
                        }
                        const cBowSlider = document.getElementById('centerBow');
                        const cBowVal = document.getElementById('centerBowVal');
                        if (cBowSlider && document.activeElement !== cBowSlider) {
                            cBowSlider.value = data.center_bird.perch.bow;
                            if (cBowVal) cBowVal.textContent = data.center_bird.perch.bow + '°';
                        }
                        const cShimmySlider = document.getElementById('centerShimmy');
                        const cShimmyVal = document.getElementById('centerShimmyVal');
                        if (cShimmySlider && document.activeElement !== cShimmySlider) {
                            cShimmySlider.value = data.center_bird.perch.shimmy;
                            if (cShimmyVal) cShimmyVal.textContent = data.center_bird.perch.shimmy + '°';
                        }
                    }
                }
                if (data.main_base) {
                    updateBaseRandomBtnUI(data.main_base.random_moving);
                    const baseSliderEl = document.getElementById('baseAngle');
                    const baseValEl = document.getElementById('baseAngleVal');
                    if (baseSliderEl && document.activeElement !== baseSliderEl) {
                        baseSliderEl.value = data.main_base.servo_angle;
                        if (baseValEl) baseValEl.textContent = data.main_base.servo_angle + '°';
                    }
                }
            })
            .catch(() => {});
    }, 500);

    // --- 6. TAB NAVIGATION & CONFIGURATION SYSTEM ---
    function switchTab(targetTabId) {
        if (!targetTabId) return;

        // Hide all tab panes & deactivate all tab buttons
        document.querySelectorAll('.tab-pane').forEach(pane => pane.style.display = 'none');
        document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));

        // Show target pane & activate matching button
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) targetPane.style.display = 'block';

        const matchingBtn = document.querySelector(`.nav-tab-btn[data-tab="${targetTabId}"]`);
        if (matchingBtn) matchingBtn.classList.add('active');

        // Tab specific triggers
        if (targetTabId === 'tabWiring') {
            initWiringDiagramEngine();
        } else if (targetTabId === 'tabConfig') {
            populateMediaDevices();
        }
    }
    window.switchTab = switchTab;

    // Attach click listeners to all tab buttons dynamically
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Populate Microphone & Audio Output Devices
    const configMicSelect = document.getElementById('configMicSelect');
    const configAudioOutputSelect = document.getElementById('configAudioOutputSelect');

    async function populateMediaDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
            const devices = await navigator.mediaDevices.enumerateDevices();

            if (configMicSelect) {
                configMicSelect.innerHTML = '<option value="default">Default System Microphone</option>';
                devices.filter(d => d.kind === 'audioinput').forEach((dev, idx) => {
                    const opt = document.createElement('option');
                    opt.value = dev.deviceId;
                    opt.textContent = dev.label || `Microphone ${idx + 1}`;
                    configMicSelect.appendChild(opt);
                });
            }

            if (configAudioOutputSelect) {
                configAudioOutputSelect.innerHTML = '<option value="default">Default System Speaker Output</option>';
                devices.filter(d => d.kind === 'audiooutput').forEach((dev, idx) => {
                    const opt = document.createElement('option');
                    opt.value = dev.deviceId;
                    opt.textContent = dev.label || `Speaker / Headphone ${idx + 1}`;
                    configAudioOutputSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.log("Device enumeration error:", e);
        }
    }

    // Camera Configuration Sync
    const configCamPreview = document.getElementById('configCamPreview');
    const camSourceSelectEl = document.getElementById('camSourceSelect');

    if (configCamSource) {
        configCamSource.addEventListener('change', (e) => {
            const srcVal = e.target.value;
            if (camSourceSelectEl) camSourceSelectEl.value = srcVal;
            sendPost('/api/camera/select', { source: srcVal });
            if (configCamPreview) configCamPreview.src = `/api/camera/frame?t=${Date.now()}`;
        });
    }

    // Microphone Level Test in Config Tab
    const btnTestMicConfig = document.getElementById('btnTestMicConfig');
    const configVuFill = document.getElementById('configVuFill');
    const configMicSensitivity = document.getElementById('configMicSensitivity');
    const configMicSensitivityVal = document.getElementById('configMicSensitivityVal');

    if (configMicSensitivity && configMicSensitivityVal) {
        configMicSensitivity.addEventListener('input', (e) => {
            configMicSensitivityVal.textContent = e.target.value + '%';
            if (micSensitivitySlider) micSensitivitySlider.value = e.target.value;
            if (micSensitivityVal) micSensitivityVal.textContent = e.target.value + '%';
        });
    }

    let configTestMicStream = null;
    let configTestAudioCtx = null;

    if (btnTestMicConfig) {
        btnTestMicConfig.addEventListener('click', async () => {
            if (configTestMicStream) {
                configTestMicStream.getTracks().forEach(t => t.stop());
                configTestMicStream = null;
                if (configTestAudioCtx) configTestAudioCtx.close();
                btnTestMicConfig.textContent = "🎙️ Test Selected Microphone";
                if (configVuFill) configVuFill.style.width = '0%';
                return;
            }

            try {
                const deviceId = configMicSelect ? configMicSelect.value : 'default';
                const constraints = { audio: deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true };
                configTestMicStream = await navigator.mediaDevices.getUserMedia(constraints);

                configTestAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source = configTestAudioCtx.createMediaStreamSource(configTestMicStream);
                const analyser = configTestAudioCtx.createAnalyser();
                analyser.fftSize = 128;
                source.connect(analyser);

                btnTestMicConfig.textContent = "⏹️ Stop Mic Test";

                function testMeterLoop() {
                    if (!configTestMicStream) return;
                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    let avg = sum / dataArray.length;
                    let pct = Math.min(100, Math.max(0, (avg / 80) * 100));
                    if (configVuFill) configVuFill.style.width = pct + '%';
                    requestAnimationFrame(testMeterLoop);
                }
                testMeterLoop();
            } catch (err) {
                alert("Could not access microphone: " + err.message);
            }
        });
    }

    // Audio Output Play Test Tone
    const btnTestAudioOutput = document.getElementById('btnTestAudioOutput');
    if (btnTestAudioOutput) {
        btnTestAudioOutput.addEventListener('click', async () => {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
                osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);

                const vol = configMasterVol ? parseInt(configMasterVol.value) / 100 : 0.8;
                gain.gain.setValueAtTime(vol * 0.3, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                if (configAudioOutputSelect && audioCtx.setSinkId && configAudioOutputSelect.value !== 'default') {
                    await audioCtx.setSinkId(configAudioOutputSelect.value).catch(() => {});
                }

                osc.start();
                osc.stop(audioCtx.currentTime + 0.6);
            } catch (e) {
                console.log("Audio test sound error:", e);
            }
        });
    }

    const configMasterVol = document.getElementById('configMasterVol');
    const configMasterVolVal = document.getElementById('configMasterVolVal');
    if (configMasterVol && configMasterVolVal) {
        configMasterVol.addEventListener('input', (e) => {
            configMasterVolVal.textContent = e.target.value + '%';
            if (songVolumeSlider) songVolumeSlider.value = e.target.value;
            if (songVolumeVal) songVolumeVal.textContent = e.target.value + '%';
            if (mp3Audio) mp3Audio.volume = parseInt(e.target.value) / 100;
        });
    }

    // AI Voice Accent Selection for Parrot 1 & Parrot 2
    const p1VoiceSelect = document.getElementById('p1VoiceSelect');
    const p2VoiceSelect = document.getElementById('p2VoiceSelect');
    const configP1VoiceSelect = document.getElementById('configP1VoiceSelect');
    const configP2VoiceSelect = document.getElementById('configP2VoiceSelect');
    const configVoiceTestText = document.getElementById('configVoiceTestText');
    const btnTestP1Voice = document.getElementById('btnTestP1Voice');
    const btnTestP2Voice = document.getElementById('btnTestP2Voice');
    const btnTestP1CardVoice = document.getElementById('btnTestP1CardVoice');
    const btnTestP2CardVoice = document.getElementById('btnTestP2CardVoice');

    let p1Voice = "ai_female_us";
    let p2Voice = "ai_male_us";

    function setP1Voice(val) {
        if (!val) return;
        p1Voice = val;
        if (p1VoiceSelect && p1VoiceSelect.value !== val) p1VoiceSelect.value = val;
        if (configP1VoiceSelect && configP1VoiceSelect.value !== val) configP1VoiceSelect.value = val;
        if (localState.parrot1) localState.parrot1.voice = val;
        sendPost('/api/birds/parrot', { parrot: 'parrot1', voice: val });
    }

    function setP2Voice(val) {
        if (!val) return;
        p2Voice = val;
        if (p2VoiceSelect && p2VoiceSelect.value !== val) p2VoiceSelect.value = val;
        if (configP2VoiceSelect && configP2VoiceSelect.value !== val) configP2VoiceSelect.value = val;
        if (localState.parrot2) localState.parrot2.voice = val;
        sendPost('/api/birds/parrot', { parrot: 'parrot2', voice: val });
    }

    if (p1VoiceSelect) p1VoiceSelect.addEventListener('change', (e) => setP1Voice(e.target.value));
    if (configP1VoiceSelect) configP1VoiceSelect.addEventListener('change', (e) => setP1Voice(e.target.value));
    if (p2VoiceSelect) p2VoiceSelect.addEventListener('change', (e) => setP2Voice(e.target.value));
    if (configP2VoiceSelect) configP2VoiceSelect.addEventListener('change', (e) => setP2Voice(e.target.value));

    function triggerParrot1TestVoice() {
        const text = (configVoiceTestText && configVoiceTestText.value.trim()) ? configVoiceTestText.value.trim() : "Squawk! Welcome to the Tropical Bird Show!";
        const selectedVoice = (configP1VoiceSelect && configP1VoiceSelect.value) || (p1VoiceSelect && p1VoiceSelect.value) || p1Voice;
        setP1Voice(selectedVoice);
        speakTextAndSyncParrot(text, 'parrot1');
    }

    function triggerParrot2TestVoice() {
        const text = (configVoiceTestText && configVoiceTestText.value.trim()) ? configVoiceTestText.value.trim() : "Squawk! Welcome to the Tropical Bird Show!";
        const selectedVoice = (configP2VoiceSelect && configP2VoiceSelect.value) || (p2VoiceSelect && p2VoiceSelect.value) || p2Voice;
        setP2Voice(selectedVoice);
        speakTextAndSyncParrot(text, 'parrot2');
    }

    if (btnTestP1Voice) btnTestP1Voice.addEventListener('click', triggerParrot1TestVoice);
    if (btnTestP1CardVoice) btnTestP1CardVoice.addEventListener('click', triggerParrot1TestVoice);

    if (btnTestP2Voice) btnTestP2Voice.addEventListener('click', triggerParrot2TestVoice);
    if (btnTestP2CardVoice) btnTestP2CardVoice.addEventListener('click', triggerParrot2TestVoice);

    // Save & Apply Configuration Button
    const btnSaveConfig = document.getElementById('btnSaveConfig');
    if (btnSaveConfig) {
        btnSaveConfig.addEventListener('click', () => {
            const settings = {
                camSource: configCamSource ? configCamSource.value : 'usb',
                micDevice: configMicSelect ? configMicSelect.value : 'default',
                audioOutput: configAudioOutputSelect ? configAudioOutputSelect.value : 'default',
                p1Voice: p1Voice,
                p2Voice: p2Voice,
                micSensitivity: configMicSensitivity ? configMicSensitivity.value : 15,
                masterVol: configMasterVol ? configMasterVol.value : 80
            };

            localStorage.setItem('birdshow_config', JSON.stringify(settings));
            alert("✅ Configuration successfully saved and applied!");
            switchTab('tabStage');
        });
    }

    // --- 7. SERVO CALIBRATION & HARDWARE OUTPUT DIAGNOSTICS ---
    const diagConsoleLog = document.getElementById('diagConsoleLog');

    function logDiag(msg) {
        if (!diagConsoleLog) return;
        const timestamp = new Date().toLocaleTimeString();
        diagConsoleLog.innerHTML += `<br>[${timestamp}] ${msg}`;
        diagConsoleLog.scrollTop = diagConsoleLog.scrollHeight;
    }

    // Servo Trim Offsets Sliders for All 14 Servos
    function adjustOffset(inputId, delta) {
        const slider = document.getElementById(inputId);
        if (!slider) return;
        let curr = parseInt(slider.value) || 0;
        let nextVal = Math.min(30, Math.max(-30, curr + delta));
        slider.value = nextVal;
        slider.dispatchEvent(new Event('input'));
    }
    window.adjustOffset = adjustOffset;

    function setupCalibOffset(id, valId, label) {
        const slider = document.getElementById(id);
        const valEl = document.getElementById(valId);
        if (slider && valEl) {
            slider.addEventListener('input', (e) => {
                const v = parseInt(e.target.value);
                valEl.textContent = (v > 0 ? '+' : '') + v + '°';
                logDiag(`Calibrated ${label} zero offset to ${(v > 0 ? '+' : '')}${v}°`);
            });
        }
    }

    const servoOffsetIds = [
        { id: 'calibP1TurnOffset', valId: 'calibP1TurnOffsetVal', label: 'Parrot 1 Turn (Ch 0)' },
        { id: 'calibP1BowOffset', valId: 'calibP1BowOffsetVal', label: 'Parrot 1 Bow (Ch 1)' },
        { id: 'calibP1ShimmyOffset', valId: 'calibP1ShimmyOffsetVal', label: 'Parrot 1 Shimmy (Ch 2)' },
        { id: 'calibP1SpotPanOffset', valId: 'calibP1SpotPanOffsetVal', label: 'Parrot 1 Spot Pan (Ch 3)' },
        { id: 'calibP1SpotTiltOffset', valId: 'calibP1SpotTiltOffsetVal', label: 'Parrot 1 Spot Tilt (Ch 4)' },
        { id: 'calibP2TurnOffset', valId: 'calibP2TurnOffsetVal', label: 'Parrot 2 Turn (Ch 6)' },
        { id: 'calibP2BowOffset', valId: 'calibP2BowOffsetVal', label: 'Parrot 2 Bow (Ch 7)' },
        { id: 'calibP2ShimmyOffset', valId: 'calibP2ShimmyOffsetVal', label: 'Parrot 2 Shimmy (Ch 8)' },
        { id: 'calibP2SpotPanOffset', valId: 'calibP2SpotPanOffsetVal', label: 'Parrot 2 Spot Pan (Ch 9)' },
        { id: 'calibP2SpotTiltOffset', valId: 'calibP2SpotTiltOffsetVal', label: 'Parrot 2 Spot Tilt (Ch 10)' },
        { id: 'calibCenterTurnOffset', valId: 'calibCenterTurnOffsetVal', label: 'Center Bird Turn (Ch 12)' },
        { id: 'calibCenterBowOffset', valId: 'calibCenterBowOffsetVal', label: 'Center Bird Bow (Ch 13)' },
        { id: 'calibCenterShimmyOffset', valId: 'calibCenterShimmyOffsetVal', label: 'Center Bird Shimmy (Ch 14)' },
        { id: 'calibBaseAngleOffset', valId: 'calibBaseAngleOffsetVal', label: 'Turntable Base (Ch 15)' }
    ];

    servoOffsetIds.forEach(item => {
        setupCalibOffset(item.id, item.valId, item.label);
    });

    function saveServoOffsets() {
        const offsets = {};
        servoOffsetIds.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) offsets[item.id] = parseInt(el.value);
        });
        localStorage.setItem('birdshow_servo_offsets', JSON.stringify(offsets));
        logDiag("💾 Saved all 14 servo calibration trim offsets to memory!");
        sendPost('/api/birds/state_update', { servo_offsets: offsets });
    }

    function loadSavedServoOffsets() {
        try {
            const saved = localStorage.getItem('birdshow_servo_offsets');
            if (!saved) return;
            const offsets = JSON.parse(saved);
            servoOffsetIds.forEach(item => {
                if (offsets[item.id] !== undefined) {
                    const el = document.getElementById(item.id);
                    const valEl = document.getElementById(item.valId);
                    if (el) el.value = offsets[item.id];
                    if (valEl) valEl.textContent = (offsets[item.id] > 0 ? '+' : '') + offsets[item.id] + '°';
                }
            });
        } catch (e) {}
    }

    function resetServoOffsets() {
        servoOffsetIds.forEach(item => {
            const el = document.getElementById(item.id);
            const valEl = document.getElementById(item.valId);
            if (el) el.value = 0;
            if (valEl) valEl.textContent = '0°';
        });
        saveServoOffsets();
        logDiag("🔄 Reset all 14 servo calibration trim offsets to 0°.");
    }

    const btnSaveCalibOffsets = document.getElementById('btnSaveCalibOffsets');
    if (btnSaveCalibOffsets) btnSaveCalibOffsets.addEventListener('click', saveServoOffsets);

    const btnResetCalibOffsets = document.getElementById('btnResetCalibOffsets');
    if (btnResetCalibOffsets) btnResetCalibOffsets.addEventListener('click', resetServoOffsets);

    loadSavedServoOffsets();

    // Center All Servos Button
    const btnCalibCenterAll = document.getElementById('btnCalibCenterAll');
    if (btnCalibCenterAll) {
        btnCalibCenterAll.addEventListener('click', () => {
            sendPost('/api/birds/perch', { parrot: 'parrot1', turn: 90, bow: 90, shimmy: 90 });
            sendPost('/api/birds/perch', { parrot: 'parrot2', turn: 90, bow: 90, shimmy: 90 });
            sendPost('/api/birds/small_birds', { center: { perch: { turn: 90, bow: 90, shimmy: 90 } } });
            sendPost('/api/birds/spotlight', { spotlight: 'parrot1', pan: 90, tilt: 90, intensity: 100 });
            sendPost('/api/birds/spotlight', { spotlight: 'parrot2', pan: 90, tilt: 90, intensity: 100 });
            sendPost('/api/birds/main_base', { angle: 90 });
            logDiag("🎯 All 3-DOF perches, spotlights & turntable centered to neutral 90° position.");
        });
    }

    // Sweep All Servos Button
    const btnCalibSweepAll = document.getElementById('btnCalibSweepAll');
    if (btnCalibSweepAll) {
        btnCalibSweepAll.addEventListener('click', () => {
            logDiag("🔄 Initiating 3-DOF servo range sweep test (45° ➔ 135° ➔ 90°)...");
            sendPost('/api/birds/perch', { parrot: 'parrot1', turn: 45, bow: 60, shimmy: 70 });
            sendPost('/api/birds/perch', { parrot: 'parrot2', turn: 135, bow: 120, shimmy: 110 });
            setTimeout(() => {
                sendPost('/api/birds/perch', { parrot: 'parrot1', turn: 135, bow: 120, shimmy: 110 });
                sendPost('/api/birds/perch', { parrot: 'parrot2', turn: 45, bow: 60, shimmy: 70 });
            }, 1000);
            setTimeout(() => {
                sendPost('/api/birds/perch', { parrot: 'parrot1', turn: 90, bow: 90, shimmy: 90 });
                sendPost('/api/birds/perch', { parrot: 'parrot2', turn: 90, bow: 90, shimmy: 90 });
                logDiag("✅ Servo sweep test finished successfully.");
            }, 2000);
        });
    }

    // L298 Test Buttons
    const btnTestP1MouthFwd = document.getElementById('btnTestP1MouthFwd');
    const btnTestP1EyesRev = document.getElementById('btnTestP1EyesRev');
    const btnTestP1Stop = document.getElementById('btnTestP1Stop');
    const btnTestP1WingsFlap = document.getElementById('btnTestP1WingsFlap');

    if (btnTestP1MouthFwd) {
        btnTestP1MouthFwd.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'mouth_open' });
            logDiag("👄 Parrot 1 L298 #1 ChA: Mouth Open (Forward Polarity)");
        });
    }
    if (btnTestP1EyesRev) {
        btnTestP1EyesRev.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'eyes_blink' });
            logDiag("👁️ Parrot 1 L298 #1 ChA: Eyes Blink Pulse (Reverse Polarity)");
        });
    }
    if (btnTestP1Stop) {
        btnTestP1Stop.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'off', wings: false });
            logDiag("🛑 Parrot 1 L298 #1 ChA & ChB Disabled.");
        });
    }
    if (btnTestP1WingsFlap) {
        btnTestP1WingsFlap.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot1', wings: true });
            logDiag("🪽 Parrot 1 L298 #1 ChB: Flapping Wings Active.");
            setTimeout(() => sendPost('/api/birds/parrot', { parrot: 'parrot1', wings: false }), 2000);
        });
    }

    const btnTestP2MouthFwd = document.getElementById('btnTestP2MouthFwd');
    const btnTestP2EyesRev = document.getElementById('btnTestP2EyesRev');
    const btnTestP2Stop = document.getElementById('btnTestP2Stop');
    const btnTestP2WingsFlap = document.getElementById('btnTestP2WingsFlap');

    if (btnTestP2MouthFwd) {
        btnTestP2MouthFwd.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'mouth_open' });
            logDiag("👄 Parrot 2 L298 #2 ChA: Mouth Open (Forward Polarity)");
        });
    }
    if (btnTestP2EyesRev) {
        btnTestP2EyesRev.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'eyes_blink' });
            logDiag("👁️ Parrot 2 L298 #2 ChA: Eyes Blink Pulse (Reverse Polarity)");
        });
    }
    if (btnTestP2Stop) {
        btnTestP2Stop.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'off', wings: false });
            logDiag("🛑 Parrot 2 L298 #2 ChA & ChB Disabled.");
        });
    }
    if (btnTestP2WingsFlap) {
        btnTestP2WingsFlap.addEventListener('click', () => {
            sendPost('/api/birds/parrot', { parrot: 'parrot2', wings: true });
            logDiag("🪽 Parrot 2 L298 #2 ChB: Flapping Wings Active.");
            setTimeout(() => sendPost('/api/birds/parrot', { parrot: 'parrot2', wings: false }), 2000);
        });
    }

    // Spotlights Test Buttons
    const btnTestSpot1Strobe = document.getElementById('btnTestSpot1Strobe');
    const btnTestSpot2Strobe = document.getElementById('btnTestSpot2Strobe');
    const btnTestFullLightShow = document.getElementById('btnTestFullLightShow');

    if (btnTestSpot1Strobe) {
        btnTestSpot1Strobe.addEventListener('click', () => {
            logDiag("💡 Strobing Spotlight #1 PWM...");
            sendPost('/api/birds/spotlight', { spotlight: 'parrot1', intensity: 100, pan: 45, tilt: 135 });
            setTimeout(() => sendPost('/api/birds/spotlight', { spotlight: 'parrot1', intensity: 20, pan: 90, tilt: 90 }), 1000);
        });
    }
    if (btnTestSpot2Strobe) {
        btnTestSpot2Strobe.addEventListener('click', () => {
            logDiag("💡 Strobing Spotlight #2 PWM...");
            sendPost('/api/birds/spotlight', { spotlight: 'parrot2', intensity: 100, pan: 135, tilt: 45 });
            setTimeout(() => sendPost('/api/birds/spotlight', { spotlight: 'parrot2', intensity: 20, pan: 90, tilt: 90 }), 1000);
        });
    }
    if (btnTestFullLightShow) {
        btnTestFullLightShow.addEventListener('click', () => {
            logDiag("🎆 Executing Full Stage Light Show Pulse Sequence!");
            sendPost('/api/birds/small_birds', { left: { spotlight: true }, right: { spotlight: true }, center: { spotlight: true } });
            sendPost('/api/birds/spotlight', { spotlight: 'parrot1', intensity: 100 });
            sendPost('/api/birds/spotlight', { spotlight: 'parrot2', intensity: 100 });
            setTimeout(() => {
                sendPost('/api/birds/spotlight', { spotlight: 'parrot1', intensity: 20 });
                sendPost('/api/birds/spotlight', { spotlight: 'parrot2', intensity: 20 });
            }, 1200);
        });
    }

    // Relay Chirp Pulse Buttons
    const btnTestRelay1Pulse = document.getElementById('btnTestRelay1Pulse');
    const btnTestRelay2Pulse = document.getElementById('btnTestRelay2Pulse');

    if (btnTestRelay1Pulse) {
        btnTestRelay1Pulse.addEventListener('click', () => {
            sendPost('/api/birds/small_birds', { left: { relay_chirp: true } });
            logDiag("⚡ Left Small Bird Relay #1 Clicked ON");
            setTimeout(() => sendPost('/api/birds/small_birds', { left: { relay_chirp: false } }), 600);
        });
    }
    if (btnTestRelay2Pulse) {
        btnTestRelay2Pulse.addEventListener('click', () => {
            sendPost('/api/birds/small_birds', { right: { relay_chirp: true } });
            logDiag("⚡ Right Small Bird Relay #2 Clicked ON");
            setTimeout(() => sendPost('/api/birds/small_birds', { right: { relay_chirp: false } }), 600);
        });
    }

    // Center Small Bird 3-DOF Perch Test Sweeps
    const btnTestCenterTurnSweep = document.getElementById('btnTestCenterTurnSweep');
    const btnTestCenterBowSweep = document.getElementById('btnTestCenterBowSweep');
    const btnTestCenterShimmySweep = document.getElementById('btnTestCenterShimmySweep');
    const btnTestCenterMotorSpin = document.getElementById('btnTestCenterMotorSpin');
    const btnTestBaseSweep = document.getElementById('btnTestBaseSweep');

    if (btnTestCenterTurnSweep) {
        btnTestCenterTurnSweep.addEventListener('click', () => {
            logDiag("🔄 Testing Center Bird Turn Servo (Yaw): 0° ➔ 180° ➔ 90°...");
            sendPost('/api/birds/small_birds', { center: { perch: { turn: 0 } } });
            setTimeout(() => sendPost('/api/birds/small_birds', { center: { perch: { turn: 180 } } }), 1000);
            setTimeout(() => sendPost('/api/birds/small_birds', { center: { perch: { turn: 90 } } }), 2000);
        });
    }

    if (btnTestCenterBowSweep) {
        btnTestCenterBowSweep.addEventListener('click', () => {
            logDiag("↕️ Testing Center Bird Bow Servo (Pitch): 45° ➔ 135° ➔ 90°...");
            sendPost('/api/birds/small_birds', { center: { perch: { bow: 45 } } });
            setTimeout(() => sendPost('/api/birds/small_birds', { center: { perch: { bow: 135 } } }), 1000);
            setTimeout(() => sendPost('/api/birds/small_birds', { center: { perch: { bow: 90 } } }), 2000);
        });
    }

    if (btnTestCenterShimmySweep) {
        btnTestCenterShimmySweep.addEventListener('click', () => {
            logDiag("↔️ Testing Center Bird Shimmy Servo (Roll): 45° ➔ 135° ➔ 90°...");
            sendPost('/api/birds/small_birds', { center: { perch: { shimmy: 45 } } });
            setTimeout(() => sendPost('/api/birds/small_birds', { center: { perch: { shimmy: 135 } } }), 1000);
            setTimeout(() => sendPost('/api/birds/small_birds', { center: { perch: { shimmy: 90 } } }), 2000);
        });
    }

    if (btnTestCenterMotorSpin) {
        btnTestCenterMotorSpin.addEventListener('click', () => {
            sendPost('/api/birds/small_birds', { center: { motor_moving: true, mouth_chirp: true } });
            logDiag("⚙️ Center Bird Gearmotor Spinning & Mouth Chirping...");
            setTimeout(() => sendPost('/api/birds/small_birds', { center: { motor_moving: false, mouth_chirp: false } }), 2500);
        });
    }
    if (btnTestBaseSweep) {
        btnTestBaseSweep.addEventListener('click', () => {
            logDiag("🔄 Sweeping Turntable Base Servo: 0° ➔ 180° ➔ 90°...");
            sendPost('/api/birds/main_base', { angle: 30, random_moving: false });
            setTimeout(() => sendPost('/api/birds/main_base', { angle: 150, random_moving: false }), 1200);
            setTimeout(() => sendPost('/api/birds/main_base', { angle: 90, random_moving: false }), 2400);
        });
    }

    // Master Diagnostic Sequencer Button
    const btnRunFullHardwareTest = document.getElementById('btnRunFullHardwareTest');
    if (btnRunFullHardwareTest) {
        btnRunFullHardwareTest.addEventListener('click', () => {
            logDiag("🚀 INITIALIZING FULL MASTER HARDWARE SELF-TEST SEQUENCER...");
            
            // Step 1: Center Servos
            setTimeout(() => {
                logDiag("📌 Step 1/6: Testing 3-DOF Perches & Base Servos...");
                sendPost('/api/birds/perch', { parrot: 'parrot1', turn: 45, bow: 120, shimmy: 90 });
                sendPost('/api/birds/perch', { parrot: 'parrot2', turn: 135, bow: 60, shimmy: 90 });
                sendPost('/api/birds/main_base', { angle: 45, random_moving: false });
            }, 800);

            // Step 2: L298 Motor Controllers
            setTimeout(() => {
                logDiag("📌 Step 2/6: Testing L298 Motor Drivers (Mouth, Eyes, Wings)...");
                sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'mouth_open', wings: true });
                sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'eyes_blink', wings: true });
            }, 2200);

            // Step 3: Relays
            setTimeout(() => {
                logDiag("📌 Step 3/6: Testing Small Bird Relays & Center Gearmotor...");
                sendPost('/api/birds/small_birds', { left: { relay_chirp: true }, right: { relay_chirp: true }, center: { motor_moving: true, mouth_chirp: true } });
            }, 3800);

            // Step 4: Spotlights
            setTimeout(() => {
                logDiag("📌 Step 4/6: Testing 2-DOF Spotlights Pan & Tilt PWM...");
                sendPost('/api/birds/spotlight', { spotlight: 'parrot1', pan: 135, tilt: 45, intensity: 100 });
                sendPost('/api/birds/spotlight', { spotlight: 'parrot2', pan: 45, tilt: 135, intensity: 100 });
            }, 5400);

            // Step 5: Reset All
            setTimeout(() => {
                logDiag("📌 Step 5/6: Resetting all hardware outputs to standby...");
                sendPost('/api/birds/parrot', { parrot: 'parrot1', mouth_eyes: 'off', wings: false });
                sendPost('/api/birds/parrot', { parrot: 'parrot2', mouth_eyes: 'off', wings: false });
                sendPost('/api/birds/small_birds', { left: { relay_chirp: false }, right: { relay_chirp: false }, center: { motor_moving: false, mouth_chirp: false } });
                sendPost('/api/birds/perch', { parrot: 'parrot1', turn: 90, bow: 90, shimmy: 90 });
                sendPost('/api/birds/perch', { parrot: 'parrot2', turn: 90, bow: 90, shimmy: 90 });
                sendPost('/api/birds/main_base', { angle: 90 });
            }, 7000);

            // Step 6: Complete
            setTimeout(() => {
                logDiag("🎉 MASTER HARDWARE SELF-TEST SEQUENCER COMPLETED SUCCESSFULLY!");
            }, 8200);
        });
    }

    // Load saved configuration if available
    function loadSavedConfig() {
        if (p1VoiceSelect && p1VoiceSelect.value) p1Voice = p1VoiceSelect.value;
        if (p2VoiceSelect && p2VoiceSelect.value) p2Voice = p2VoiceSelect.value;

        try {
            const saved = localStorage.getItem('birdshow_config');
            if (!saved) return;
            const settings = JSON.parse(saved);

            if (settings.camSource && configCamSource) {
                configCamSource.value = settings.camSource;
                if (camSourceSelectEl) camSourceSelectEl.value = settings.camSource;
                sendPost('/api/camera/select', { source: settings.camSource });
            }
            if (settings.p1Voice) {
                setP1Voice(settings.p1Voice);
            }
            if (settings.p2Voice) {
                setP2Voice(settings.p2Voice);
            }
            if (settings.voice && !settings.p1Voice) {
                setP1Voice(settings.voice);
            }
            if (settings.micSensitivity && configMicSensitivity) {
                configMicSensitivity.value = settings.micSensitivity;
                if (configMicSensitivityVal) configMicSensitivityVal.textContent = settings.micSensitivity + '%';
                if (micSensitivitySlider) micSensitivitySlider.value = settings.micSensitivity;
                if (micSensitivityVal) micSensitivityVal.textContent = settings.micSensitivity + '%';
            }
            if (settings.masterVol && configMasterVol) {
                configMasterVol.value = settings.masterVol;
                if (configMasterVolVal) configMasterVolVal.textContent = settings.masterVol + '%';
                if (songVolumeSlider) songVolumeSlider.value = settings.masterVol;
                if (songVolumeVal) songVolumeVal.textContent = settings.masterVol + '%';
                if (mp3Audio) mp3Audio.volume = parseInt(settings.masterVol) / 100;
            }
        } catch (e) {}
    }
    loadSavedConfig();

    // --- 8. INTERACTIVE WIRING DIAGRAM & PINOUT SCHEMATIC ENGINE ---
    const pinoutConnectionsData = [
        { module: "Raspberry Pi", pin: "Pin 3", signal: "GPIO 2 (SDA1)", color: "#00f0ff", hex: "#00f0ff", target: "PCA9685 PWM Driver", term: "SDA Terminal", cat: "i2c", desc: "I2C Serial Data Bus for 16-Channel Servo Controller" },
        { module: "Raspberry Pi", pin: "Pin 5", signal: "GPIO 3 (SCL1)", color: "#3399ff", hex: "#3399ff", target: "PCA9685 PWM Driver", term: "SCL Terminal", cat: "i2c", desc: "I2C Serial Clock Line for 16-Channel Servo Controller" },
        { module: "Raspberry Pi", pin: "Pin 11", signal: "GPIO 17", color: "#ffd700", hex: "#ffd700", target: "2-Channel Relay Module", term: "Relay #1 IN", cat: "relays", desc: "Front Left Small Bird Chirp Sound Circuit Relay Trigger" },
        { module: "Raspberry Pi", pin: "Pin 12", signal: "GPIO 18 (PWM)", color: "#ff00cc", hex: "#ff00cc", target: "L298N Driver #1 (Parrot 1)", term: "ENA (Channel A PWM)", cat: "l298", desc: "Parrot 1 Mouth / Eyes Actuator PWM Speed Control" },
        { module: "Raspberry Pi", pin: "Pin 13", signal: "GPIO 27", color: "#ffa500", hex: "#ffa500", target: "2-Channel Relay Module", term: "Relay #2 IN", cat: "relays", desc: "Front Right Small Bird Chirp Sound Circuit Relay Trigger" },
        { module: "Raspberry Pi", pin: "Pin 15", signal: "GPIO 22", color: "#00ff88", hex: "#00ff88", target: "Transistor Motor Driver", term: "Gate / Base Signal", cat: "relays", desc: "Center Small Bird Gearmotor & Beak Movement Driver" },
        { module: "Raspberry Pi", pin: "Pin 16", signal: "GPIO 23", color: "#3399ff", hex: "#3399ff", target: "L298N Driver #1 (Parrot 1)", term: "IN1 (Channel A Direction)", cat: "l298", desc: "Parrot 1 Channel A Polarity 1 (Forward = Open Mouth)" },
        { module: "Raspberry Pi", pin: "Pin 18", signal: "GPIO 24", color: "#3399ff", hex: "#3399ff", target: "L298N Driver #1 (Parrot 1)", term: "IN2 (Channel A Direction)", cat: "l298", desc: "Parrot 1 Channel A Polarity 2 (Reverse = Eyes Blink Pulse)" },
        { module: "Raspberry Pi", pin: "Pin 22", signal: "GPIO 25", color: "#ff00cc", hex: "#ff00cc", target: "L298N Driver #1 (Parrot 1)", term: "IN3 (Channel B Direction)", cat: "l298", desc: "Parrot 1 Flapping Wings Motor Direction Line 1" },
        { module: "Raspberry Pi", pin: "Pin 24", signal: "GPIO 8", color: "#ff00cc", hex: "#ff00cc", target: "L298N Driver #1 (Parrot 1)", term: "IN4 (Channel B Direction)", cat: "l298", desc: "Parrot 1 Flapping Wings Motor Direction Line 2" },
        { module: "Raspberry Pi", pin: "Pin 32", signal: "GPIO 12 (PWM)", color: "#00f0ff", hex: "#00f0ff", target: "L298N Driver #2 (Parrot 2)", term: "ENA (Channel A PWM)", cat: "l298", desc: "Parrot 2 Mouth / Eyes Actuator PWM Speed Control" },
        { module: "Raspberry Pi", pin: "Pin 33", signal: "GPIO 13 (PWM)", color: "#00f0ff", hex: "#00f0ff", target: "L298N Driver #2 (Parrot 2)", term: "ENB (Channel B PWM)", cat: "l298", desc: "Parrot 2 Flapping Wings Motor PWM Speed Control" },
        { module: "Raspberry Pi", pin: "Pin 35", signal: "GPIO 19 (PWM)", color: "#ff00cc", hex: "#ff00cc", target: "L298N Driver #1 (Parrot 1)", term: "ENB (Channel B PWM)", cat: "l298", desc: "Parrot 1 Flapping Wings Motor PWM Speed Control" },
        { module: "Raspberry Pi", pin: "Pin 36", signal: "GPIO 16", color: "#00f0ff", hex: "#00f0ff", target: "L298N Driver #2 (Parrot 2)", term: "IN1 (Channel A Direction)", cat: "l298", desc: "Parrot 2 Channel A Polarity 1 (Forward = Open Mouth)" },
        { module: "Raspberry Pi", pin: "Pin 37", signal: "GPIO 26", color: "#00f0ff", hex: "#00f0ff", target: "L298N Driver #2 (Parrot 2)", term: "IN4 (Channel B Direction)", cat: "l298", desc: "Parrot 2 Flapping Wings Motor Direction Line 2" },
        { module: "Raspberry Pi", pin: "Pin 38", signal: "GPIO 20", color: "#00f0ff", hex: "#00f0ff", target: "L298N Driver #2 (Parrot 2)", term: "IN2 (Channel A Direction)", cat: "l298", desc: "Parrot 2 Channel A Polarity 2 (Reverse = Eyes Blink Pulse)" },
        { module: "Raspberry Pi", pin: "Pin 40", signal: "GPIO 21", color: "#00f0ff", hex: "#00f0ff", target: "L298N Driver #2 (Parrot 2)", term: "IN3 (Channel B Direction)", cat: "l298", desc: "Parrot 2 Flapping Wings Motor Direction Line 1" },
        { module: "PCA9685 PWM", pin: "Channel 0", signal: "PWM Servo Out", color: "#ff3344", hex: "#ff3344", target: "Parrot 1 (Left)", term: "3-DOF Perch Turn Servo (Yaw)", cat: "servos", desc: "Parrot 1 Base Left/Right Turn Motor (0-180°)" },
        { module: "PCA9685 PWM", pin: "Channel 1", signal: "PWM Servo Out", color: "#ff3344", hex: "#ff3344", target: "Parrot 1 (Left)", term: "3-DOF Perch Bow Servo (Pitch)", cat: "servos", desc: "Parrot 1 Forward/Backward Bowing Motor (0-180°)" },
        { module: "PCA9685 PWM", pin: "Channel 2", signal: "PWM Servo Out", color: "#ff3344", hex: "#ff3344", target: "Parrot 1 (Left)", term: "3-DOF Perch Shimmy Servo (Roll)", cat: "servos", desc: "Parrot 1 Body Side-to-Side Shimmy Motor (0-180°)" },
        { module: "PCA9685 PWM", pin: "Channel 3", signal: "PWM Servo Out", color: "#ffd700", hex: "#ffd700", target: "Parrot 1 Spotlight", term: "2-DOF Pan Servo", cat: "servos", desc: "Spotlight #1 Horizontal Pan Servo" },
        { module: "PCA9685 PWM", pin: "Channel 4", signal: "PWM Servo Out", color: "#ffd700", hex: "#ffd700", target: "Parrot 1 Spotlight", term: "2-DOF Tilt Servo", cat: "servos", desc: "Spotlight #1 Vertical Tilt Servo" },
        { module: "PCA9685 PWM", pin: "Channel 5", signal: "PWM Dimmer Out", color: "#ffd700", hex: "#ffd700", target: "Parrot 1 Spotlight", term: "PWM LED Dimmer Input", cat: "servos", desc: "Spotlight #1 High-Brightness LED Intensity PWM Control" },
        { module: "PCA9685 PWM", pin: "Channel 6", signal: "PWM Servo Out", color: "#00f0ff", hex: "#00f0ff", target: "Parrot 2 (Right)", term: "3-DOF Perch Turn Servo (Yaw)", cat: "servos", desc: "Parrot 2 Base Left/Right Turn Motor (0-180°)" },
        { module: "PCA9685 PWM", pin: "Channel 7", signal: "PWM Servo Out", color: "#00f0ff", hex: "#00f0ff", target: "Parrot 2 (Right)", term: "3-DOF Perch Bow Servo (Pitch)", cat: "servos", desc: "Parrot 2 Forward/Backward Bowing Motor (0-180°)" },
        { module: "PCA9685 PWM", pin: "Channel 8", signal: "PWM Servo Out", color: "#00f0ff", hex: "#00f0ff", target: "Parrot 2 (Right)", term: "3-DOF Perch Shimmy Servo (Roll)", cat: "servos", desc: "Parrot 2 Body Side-to-Side Shimmy Motor (0-180°)" },
        { module: "PCA9685 PWM", pin: "Channel 9", signal: "PWM Servo Out", color: "#ffd700", hex: "#ffd700", target: "Parrot 2 Spotlight", term: "2-DOF Pan Servo", cat: "servos", desc: "Spotlight #2 Horizontal Pan Servo" },
        { module: "PCA9685 PWM", pin: "Channel 10", signal: "PWM Servo Out", color: "#ffd700", hex: "#ffd700", target: "Parrot 2 Spotlight", term: "2-DOF Tilt Servo", cat: "servos", desc: "Spotlight #2 Vertical Tilt Servo" },
        { module: "PCA9685 PWM", pin: "Channel 11", signal: "PWM Dimmer Out", color: "#ffd700", hex: "#ffd700", target: "Parrot 2 Spotlight", term: "PWM LED Dimmer Input", cat: "servos", desc: "Spotlight #2 High-Brightness LED Intensity PWM Control" },
        { module: "PCA9685 PWM", pin: "Channel 12", signal: "PWM Servo Out", color: "#00ff88", hex: "#00ff88", target: "Center Small Bird", term: "3-DOF Perch Turn Servo (Yaw)", cat: "servos", desc: "Center Front Small Bird Turn Motor" },
        { module: "PCA9685 PWM", pin: "Channel 13", signal: "PWM Servo Out", color: "#00ff88", hex: "#00ff88", target: "Center Small Bird", term: "3-DOF Perch Bow Servo (Pitch)", cat: "servos", desc: "Center Front Small Bird Bowing Motor" },
        { module: "PCA9685 PWM", pin: "Channel 14", signal: "PWM Servo Out", color: "#00ff88", hex: "#00ff88", target: "Center Small Bird", term: "3-DOF Perch Shimmy Servo (Roll)", cat: "servos", desc: "Center Front Small Bird Shimmy Motor" },
        { module: "PCA9685 PWM", pin: "Channel 15", signal: "PWM Servo Out", color: "#a855f7", hex: "#a855f7", target: "Main Stage Base", term: "Turntable Base Servo Motor", cat: "servos", desc: "Whole Stage Rotating Turntable Base Drive Servo" },
        { module: "Power Supply", pin: "+5V / +6V", signal: "Ext Power Rail", color: "#ff3344", hex: "#ff3344", target: "PCA9685 V+ / L298N 12V", term: "Power Terminal Screws", cat: "power", desc: "High-Current 12A Power Supply for Servos and Gearmotors" },
        { module: "Power Supply", pin: "GND Bus", signal: "Common Ground", color: "#ffffff", hex: "#aaaaaa", target: "All Boards & Pi GND", term: "Ground Rail", cat: "power", desc: "Shared Common Reference Ground across all Modules" }
    ];

    let currentWiringFilter = "all";
    let wiringEngineInitialized = false;

    function renderPinoutTable(filterCat = "all", searchQuery = "") {
        const tbody = document.getElementById('pinoutTableBody');
        const countBadge = document.getElementById('tableRowCount');
        if (!tbody) return;

        tbody.innerHTML = '';
        let filtered = pinoutConnectionsData.filter(item => {
            const matchesCat = (filterCat === "all" || item.cat === filterCat);
            const q = searchQuery.toLowerCase().trim();
            const matchesQuery = !q || (
                item.module.toLowerCase().includes(q) ||
                item.pin.toLowerCase().includes(q) ||
                item.signal.toLowerCase().includes(q) ||
                item.target.toLowerCase().includes(q) ||
                item.term.toLowerCase().includes(q) ||
                item.desc.toLowerCase().includes(q)
            );
            return matchesCat && matchesQuery;
        });

        if (countBadge) countBadge.textContent = `Showing ${filtered.length} Connected Lines`;

        filtered.forEach(item => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-pin-num', item.pin.replace(/[^0-9]/g, ''));
            tr.setAttribute('data-category', item.cat);

            tr.innerHTML = `
                <td><strong style="color:var(--text-main);">${item.module}</strong></td>
                <td><span class="color-pill" style="background: rgba(255,255,255,0.06); color: ${item.hex}; border: 1px solid ${item.hex};">${item.pin}</span></td>
                <td><code style="color:var(--accent-cyan); font-weight:bold;">${item.signal}</code></td>
                <td><span class="color-pill" style="background: rgba(0,0,0,0.3); color: ${item.hex};"><span class="color-dot" style="background:${item.hex};"></span>${item.color}</span></td>
                <td><strong style="color:var(--text-main);">${item.target}</strong></td>
                <td><code style="color:var(--accent-yellow);">${item.term}</code></td>
                <td style="font-size:0.8rem; color:var(--text-muted);">${item.desc}</td>
            `;

            tr.addEventListener('mouseenter', () => {
                tr.classList.add('row-highlight');
                highlightSvgPinAndWire(item.pin, item.cat, true);
            });

            tr.addEventListener('mouseleave', () => {
                tr.classList.remove('row-highlight');
                highlightSvgPinAndWire(item.pin, item.cat, false);
            });

            tbody.appendChild(tr);
        });
    }

    function highlightSvgPinAndWire(pinStr, cat, active) {
        const pinNum = pinStr.replace(/[^0-9]/g, '');
        const pinBoxes = document.querySelectorAll(`.pin-box[data-pin="${pinNum}"]`);
        pinBoxes.forEach(box => box.classList.toggle('active', active));

        const wires = document.querySelectorAll('.wire');
        wires.forEach(wire => {
            if (active) {
                if (wire.getAttribute('data-category') === cat) {
                    wire.classList.add('active-highlight');
                    wire.classList.remove('dimmed');
                } else {
                    wire.classList.add('dimmed');
                }
            } else {
                wire.classList.remove('active-highlight');
                wire.classList.remove('dimmed');
            }
        });
    }

    function applyWiringFilter(filterCat) {
        currentWiringFilter = filterCat;
        const badge = document.getElementById('wireFilterBadge');
        if (badge) badge.textContent = `Filter: ${filterCat.toUpperCase()} Connections`;

        const filterBtns = document.querySelectorAll('.wire-filter-btn');
        filterBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-filter') === filterCat));

        const wires = document.querySelectorAll('.wire');
        wires.forEach(wire => {
            const cat = wire.getAttribute('data-category');
            if (filterCat === 'all' || cat === filterCat) {
                wire.style.display = '';
                wire.classList.remove('dimmed');
            } else {
                wire.style.display = 'none';
            }
        });

        const searchVal = document.getElementById('pinSearchInput') ? document.getElementById('pinSearchInput').value : '';
        renderPinoutTable(filterCat, searchVal);
    }

    function initWiringDiagramEngine() {
        if (wiringEngineInitialized) return;
        wiringEngineInitialized = true;

        renderPinoutTable('all', '');

        // Wire Filter Buttons
        const filterBtns = document.querySelectorAll('.wire-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-filter');
                applyWiringFilter(cat);
            });
        });

        // Search Input
        const searchInput = document.getElementById('pinSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderPinoutTable(currentWiringFilter, e.target.value);
            });
        }

        // SVG Pin Box Click / Hover
        document.querySelectorAll('.pin-box').forEach(box => {
            box.addEventListener('mouseenter', () => {
                const pinNum = box.getAttribute('data-pin');
                highlightSvgPinAndWire(pinNum, 'all', true);
            });
            box.addEventListener('mouseleave', () => {
                const pinNum = box.getAttribute('data-pin');
                highlightSvgPinAndWire(pinNum, 'all', false);
            });
        });

        // Download PDF Schematic Button
        const btnDownloadPdf = document.getElementById('btnDownloadPdf');
        if (btnDownloadPdf) {
            btnDownloadPdf.addEventListener('click', () => {
                window.location.href = '/api/export-pdf';
            });
        }

        // Download CSV Spreadsheet Button
        const btnDownloadCsv = document.getElementById('btnDownloadCsv');
        if (btnDownloadCsv) {
            btnDownloadCsv.addEventListener('click', () => {
                window.location.href = '/api/export-csv';
            });
        }

        // Download SVG Schematic Button
        const btnDownloadSvg = document.getElementById('btnDownloadSvg');
        if (btnDownloadSvg) {
            btnDownloadSvg.addEventListener('click', () => {
                const svgEl = document.getElementById('wiringSvg');
                if (!svgEl) return;

                const serializer = new XMLSerializer();
                let source = serializer.serializeToString(svgEl);

                if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
                    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }

                const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Animatronic_Bird_Show_Wiring_Schematic.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Print Schematic Button
        const btnPrintSchematic = document.getElementById('btnPrintSchematic');
        if (btnPrintSchematic) {
            btnPrintSchematic.addEventListener('click', () => {
                window.print();
            });
        }
    }
});
