# 🦜 ANIMATRONIC BIRD SHOW - HARDWARE WIRING DIAGRAM & SCHEMATIC GUIDE

This document details all physical hardware connections, Raspberry Pi GPIO pin mappings, PCA9685 12-bit PWM channel assignments driving 3.3V gate / 12V power supply MOSFET power transistors for DC stage spotlights, mechanical chirp relays, L298N motor driver connections, and power distribution rails for the Animatronic Bird Show Master Controller.

---

## 📐 OVERVIEW OF SYSTEM HARDWARE ARCHITECTURE

```
+-----------------------------------------------------------------------------------+
|                                  MAIN POWER SUPPLY                                |
|  +12V DC @ 10A (MOSFET Stage Spotlights)    +5V / +6V @ 12A DC (Servos & Motors) |
|  +5V @ 3A DC (Raspberry Pi Logic)                                                 |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                              RASPBERRY PI 4 / 5 MCU                               |
| - 40-Pin GPIO Header                                                              |
| - I2C Bus (SDA: GPIO 2, SCL: GPIO 3) -> PCA9685 PWM Servo & MOSFET Controller    |
| - Mechanical Relays: GPIO 17 (Relay #1 Chirp), GPIO 27 (Relay #2 Chirp)          |
| - 2x L298N Motor Drivers: GPIO 18 ENA, 23 IN1, 24 IN2, 19 ENB, 25 IN3, 8 IN4      |
|   and GPIO 12 ENA, 16 IN1, 20 IN2, 13 ENB, 21 IN3, 26 IN4                         |
+-----+----------------------+---------------------+--------------------------------+
      | (I2C Bus)            | (PWM & GPIO)        | (Mechanical Relays)
      v                      v                     v
+-----+--------------+  +----+---------------+  +--+--------------------------------+
| PCA9685 16-CHANNEL |  | 2x L298N DUAL      |  | 2-CHANNEL MECHANICAL RELAY BOARD  |
| 12-BIT PWM DRIVER  |  | H-BRIDGE DRIVERS   |  | & TRANSISTOR MOTOR DRIVERS        |
| (I2C Addr: 0x40)   |  | (#1 & #2)          |  | (Chirp Circuits & Beak Motors)    |
+-----+--------------+  +----+---------------+  +-----------------------------------+
      |                      |
      | (PCA9685 PWM to MOSFETs: 3.3V Gate / 12V Power)
      v                      v
+-----+----------------------+------------------------------------------------------+
|                       ANIMATRONIC STAGE ACTUATORS & DC LIGHTS                     |
| - Parrot 1 (Left Tall): 3-DOF Perch + 2-DOF Spotlight + Mouth/Eyes & Wing Motors  |
| - Parrot 2 (Right Tall): 3-DOF Perch + 2-DOF Spotlight + Mouth/Eyes & Wing Motors |
| - PCA9685 -> 3.3V Gate / 12V Power MOSFET DC Stage Spotlights:                    |
|   * PCA Ch 5: Parrot 1 Dimmable LED Spotlight MOSFET PWM Dimmer (12V DC)         |
|   * PCA Ch 11: Parrot 2 Dimmable LED Spotlight MOSFET PWM Dimmer (12V DC)        |
| - Mechanical Chirp Relays:                                                        |
|   * Relay #1 (GPIO 17 Mechanical): Front Left Small Bird Mechanical Chirp Relay   |
|   * Relay #2 (GPIO 27 Mechanical): Front Right Small Bird Mechanical Chirp Relay  |
| - Center Small Bird: 3-DOF Perch + Beak & Body Gearmotor                          |
| - Main Stage Turntable: 360°/180° Base Rotating Servo Motor                       |
+-----------------------------------------------------------------------------------+
```

---

## 🍓 1. RASPBERRY PI 40-PIN GPIO PINOUT MAP

| Header Pin # | GPIO Name | Function / Signal Description | Target Module Connected | Wire Color Code |
| :---: | :---: | :--- | :--- | :--- |
| **Pin 1** | 3.3V Power | Logic VCC (3.3V) | Sensors / Optional Logic | 🟡 Yellow / Orange |
| **Pin 2** | 5V Power | Logic VCC (5V) | PCA9685 VCC & Relay VCC | 🔴 Red |
| **Pin 3** | GPIO 2 (SDA1) | I2C Serial Data | PCA9685 SDA Terminal | 🔵 Cyan |
| **Pin 4** | 5V Power | Secondary 5V VCC | Power Rail | 🔴 Red |
| **Pin 5** | GPIO 3 (SCL1) | I2C Serial Clock | PCA9685 SCL Terminal | 🟦 Blue |
| **Pin 6** | Ground (GND) | Common Reference Ground | Common GND Bus | ⬛ Black / Grey |
| **Pin 11** | GPIO 17 | Digital Output | 2-Ch Mechanical Relay #1 (Left Bird Chirp) | 🟠 Gold |
| **Pin 12** | GPIO 18 | PWM Output | L298N #1 ENA (P1 Mouth/Eyes Speed) | 🟣 Magenta |
| **Pin 13** | GPIO 27 | Digital Output | 2-Ch Mechanical Relay #2 (Right Bird Chirp) | 🟠 Gold |
| **Pin 14** | Ground (GND) | Common Ground | Common GND Bus | ⬛ Black |
| **Pin 15** | GPIO 22 | Digital / PWM | Center Bird Transistor Motor Driver | 🟢 Green |
| **Pin 16** | GPIO 23 | Digital Output | L298N #1 IN1 (P1 Mouth/Eyes Polarity 1) | 🟦 Blue |
| **Pin 18** | GPIO 24 | Digital Output | L298N #1 IN2 (P1 Mouth/Eyes Polarity 2) | 🟦 Blue |
| **Pin 22** | GPIO 25 | Digital Output | L298N #1 IN3 (P1 Wings Direction 1) | 🟣 Magenta |
| **Pin 24** | GPIO 8 | Digital Output | L298N #1 IN4 (P1 Wings Direction 2) | 🟣 Magenta |
| **Pin 32** | GPIO 12 | PWM Output | L298N #2 ENA (P2 Mouth/Eyes Speed) | 🔵 Cyan |
| **Pin 33** | GPIO 13 | PWM Output | L298N #2 ENB (P2 Wings Speed) | 🔵 Cyan |
| **Pin 35** | GPIO 19 | PWM Output | L298N #1 ENB (P1 Wings Speed) | 🟣 Magenta |
| **Pin 36** | GPIO 16 | Digital Output | L298N #2 IN1 (P2 Mouth/Eyes Polarity 1) | 🔵 Cyan |
| **Pin 37** | GPIO 26 | Digital Output | L298N #2 IN4 (P2 Wings Direction 2) | 🔵 Cyan |
| **Pin 38** | GPIO 20 | Digital Output | L298N #2 IN2 (P2 Mouth/Eyes Polarity 2) | 🔵 Cyan |
| **Pin 40** | GPIO 21 | Digital Output | L298N #2 IN3 (P2 Wings Direction 1) | 🔵 Cyan |

---

## 🎛️ 2. PCA9685 16-CHANNEL PWM SERVO & MOSFET LIGHTING DRIVER (I2C Addr: 0x40)

| Channel # | Connected Servo / Hardware Output | Function Description | Signal Range & Voltage |
| :---: | :--- | :--- | :---: |
| **Ch 0** | Parrot 1 (Left) 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (5V) |
| **Ch 1** | Parrot 1 (Left) 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (5V) |
| **Ch 2** | Parrot 1 (Left) 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (5V) |
| **Ch 3** | Parrot 1 Spotlight | Horizontal Pan Servo Motor | 500μs - 2500μs (5V) |
| **Ch 4** | Parrot 1 Spotlight | Vertical Tilt Servo Motor | 500μs - 2500μs (5V) |
| **Ch 5** | Parrot 1 Spotlight LED MOSFET | 3.3V Gate MOSFET -> 12V LED Spotlight PWM Dimmer | 0% - 100% PWM (12V) |
| **Ch 6** | Parrot 2 (Right) 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (5V) |
| **Ch 7** | Parrot 2 (Right) 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 8** | Parrot 2 (Right) 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 9** | Parrot 2 Spotlight | Horizontal Pan Servo Motor | 500μs - 2500μs (0° - 180°) |
| **Ch 10** | Parrot 2 Spotlight | Vertical Tilt Servo Motor | 500μs - 2500μs (0° - 180°) |
| **Ch 11** | Parrot 2 Spotlight LED MOSFET | 3.3V Gate MOSFET -> 12V LED Spotlight PWM Dimmer | 0% - 100% PWM (12V) |
| **Ch 12** | Center Small Bird 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 13** | Center Small Bird 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 14** | Center Small Bird 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 15** | Main Stage Turntable Base | Turntable Rotating Servo Motor | 500μs - 2500μs (Continuous) |

---

## ⚙️ 3. L298N DUAL H-BRIDGE MOTOR CONTROLLERS & MECHANICAL CHIRP RELAYS

### Mechanical Chirp Relays
- **Relay #1 (GPIO 17 Mechanical Relay):** Mechanical relay switching physical audio circuit for Front Left Small Bird chirp sound.
- **Relay #2 (GPIO 27 Mechanical Relay):** Mechanical relay switching physical audio circuit for Front Right Small Bird chirp sound.

### L298N Module #1 (Parrot 1 - Left Tall Parrot)
- **Power:** +12V/+5V Screw Terminal -> +5V/+6V High Current Power Rail | GND -> Common GND Bus
- **Channel A (Mouth & Blinking Eyes Actuator):**
  - `ENA` (PWM) -> GPIO 18 (Pin 12) | `IN1` -> GPIO 23 (Pin 16) | `IN2` -> GPIO 24 (Pin 18)
  - Forward Polarity (`IN1=HIGH, IN2=LOW`): Mouth Open
  - Reverse Polarity (`IN1=LOW, IN2=HIGH`): Eyes Blink

---

## 💡 4. PCA9685-DRIVEN MOSFET DC LIGHTING & POWER DISTRIBUTION

1. **Dimmable Stage Spotlights (PCA9685 -> 3.3V Gate / 12V Power MOSFETs):**
   - All DC spotlights (Parrot 1 Spotlight on `PCA Ch 5`, Parrot 2 Spotlight on `PCA Ch 11`) are driven by **PCA9685 12-bit PWM channels** controlling **3.3V gate / 12V power supply MOSFET power transistors**.
   - Enables full 12-bit PWM brightness dimming, spotlight sweeps, and spotlight intensity fades.

2. **Common Ground:**
   - Connect Raspberry Pi GND, PCA9685 GND, L298N GND, MOSFET source GND, Relay GND, and Power Supply GND together to a shared common ground bus.
