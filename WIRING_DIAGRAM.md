# 🦜 ANIMATRONIC BIRD SHOW - HARDWARE WIRING DIAGRAM & SCHEMATIC GUIDE

This document details all physical hardware connections, Raspberry Pi GPIO pin mappings, PCA9685 PWM channel assignments, L298N motor driver connections, relay triggers, and power distribution rails for the Animatronic Bird Show Master Controller.

---

## 📐 OVERVIEW OF SYSTEM HARDWARE ARCHITECTURE

```
+-----------------------------------------------------------------------------------+
|                                  MAIN POWER SUPPLY                                |
|  5V / 6V @ 12A DC (Servos & Gearmotors)      +5V @ 3A DC (Raspberry Pi Logic)     |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                              RASPBERRY PI 4 / 5 MCU                               |
| - 40-Pin GPIO Header                                                              |
| - I2C Bus (SDA: GPIO 2, SCL: GPIO 3)                                              |
| - CSI Video Camera / USB Webcams                                                  |
| - 3.5mm Headphone Jack / USB Audio Out                                            |
+-----+----------------------+---------------------+--------------------------------+
      | (I2C Bus)            | (PWM & GPIO)        | (GPIO Triggers)
      v                      v                     v
+-----+--------------+  +----+---------------+  +--+--------------------------------+
| PCA9685 16-CHANNEL |  | 2x L298N DUAL      |  | 2-CHANNEL RELAY BOARD &          |
| 12-BIT PWM DRIVER  |  | H-BRIDGE DRIVERS   |  | TRANSISTOR MOTOR DRIVERS          |
| (I2C Addr: 0x40)   |  | (#1 & #2)          |  | (Chirp Circuits & Beak Motors)    |
+-----+--------------+  +----+---------------+  +--+--------------------------------+
      |                      |                     |
      v                      v                     v
+-----+----------------------+---------------------+--------------------------------+
|                       ANIMATRONIC STAGE ACTUATORS & ENDPOINTS                     |
| - Parrot 1 (Left Tall): 3-DOF Perch + 2-DOF Spotlight + Mouth/Eyes & Wing Motors  |
| - Parrot 2 (Right Tall): 3-DOF Perch + 2-DOF Spotlight + Mouth/Eyes & Wing Motors |
| - Center Small Bird: 3-DOF Perch + Beak & Body Gearmotor                          |
| - 4 Small Birds: Spotlights, Chirp Relays & Movement Motors                      |
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
| **Pin 11** | GPIO 17 | Digital Output | 2-Ch Relay #1 (Left Bird Chirp) | 🟠 Gold |
| **Pin 12** | GPIO 18 | PWM Output | L298N #1 ENA (P1 Mouth/Eyes Speed) | 🟣 Magenta |
| **Pin 13** | GPIO 27 | Digital Output | 2-Ch Relay #2 (Right Bird Chirp) | 🟠 Gold |
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

## 🎛️ 2. PCA9685 16-CHANNEL PWM SERVO DRIVER (I2C Addr: 0x40)

| Channel # | Connected Servo / Hardware Output | Function Description | PWM Signal Range |
| :---: | :--- | :--- | :---: |
| **Ch 0** | Parrot 1 (Left) 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 1** | Parrot 1 (Left) 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 2** | Parrot 1 (Left) 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 3** | Parrot 1 Spotlight | Horizontal Pan Servo Motor | 500μs - 2500μs (0° - 180°) |
| **Ch 4** | Parrot 1 Spotlight | Vertical Tilt Servo Motor | 500μs - 2500μs (0° - 180°) |
| **Ch 5** | Parrot 1 Spotlight LED | High-Brightness PWM LED Dimmer | 0% - 100% Duty Cycle |
| **Ch 6** | Parrot 2 (Right) 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 7** | Parrot 2 (Right) 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 8** | Parrot 2 (Right) 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 9** | Parrot 2 Spotlight | Horizontal Pan Servo Motor | 500μs - 2500μs (0° - 180°) |
| **Ch 10** | Parrot 2 Spotlight | Vertical Tilt Servo Motor | 500μs - 2500μs (0° - 180°) |
| **Ch 11** | Parrot 2 Spotlight LED | High-Brightness PWM LED Dimmer | 0% - 100% Duty Cycle |
| **Ch 12** | Center Small Bird 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 13** | Center Small Bird 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 14** | Center Small Bird 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (0° - 180°) |
| **Ch 15** | Main Stage Turntable Base | Turntable Rotating Servo Motor | 500μs - 2500μs (Continuous/Angle) |

---

## ⚙️ 3. L298N DUAL H-BRIDGE MOTOR CONTROLLERS

### L298N Module #1 (Parrot 1 - Left Tall Parrot)
- **Power:** +12V/+5V Screw Terminal -> +5V/+6V High Current Power Rail | GND -> Common GND Bus
- **Channel A (Mouth & Blinking Eyes Actuator):**
  - `ENA` (PWM Enable) -> Raspberry Pi **GPIO 18** (Pin 12)
  - `IN1` (Direction 1) -> Raspberry Pi **GPIO 23** (Pin 16)
  - `IN2` (Direction 2) -> Raspberry Pi **GPIO 24** (Pin 18)
  - `OUT1 / OUT2` Screw Terminals -> Solenoid / DC Actuator
    - *Forward Polarity (`IN1=HIGH, IN2=LOW`):* Opens Beak/Mouth
    - *Reverse Polarity (`IN1=LOW, IN2=HIGH`):* Pulses Blinking Eyes Shutter
- **Channel B (Flapping Wings DC Motor):**
  - `ENB` (PWM Enable) -> Raspberry Pi **GPIO 19** (Pin 35)
  - `IN3` (Direction 1) -> Raspberry Pi **GPIO 25** (Pin 22)
  - `IN4` (Direction 2) -> Raspberry Pi **GPIO 8** (Pin 24)
  - `OUT3 / OUT4` Screw Terminals -> Wing Mechanism Gearmotor

### L298N Module #2 (Parrot 2 - Right Tall Parrot)
- **Power:** +12V/+5V Screw Terminal -> +5V/+6V High Current Power Rail | GND -> Common GND Bus
- **Channel A (Mouth & Blinking Eyes Actuator):**
  - `ENA` (PWM Enable) -> Raspberry Pi **GPIO 12** (Pin 32)
  - `IN1` (Direction 1) -> Raspberry Pi **GPIO 16** (Pin 36)
  - `IN2` (Direction 2) -> Raspberry Pi **GPIO 20** (Pin 38)
  - `OUT1 / OUT2` Screw Terminals -> Solenoid / DC Actuator
- **Channel B (Flapping Wings DC Motor):**
  - `ENB` (PWM Enable) -> Raspberry Pi **GPIO 13** (Pin 33)
  - `IN3` (Direction 1) -> Raspberry Pi **GPIO 21** (Pin 40)
  - `IN4` (Direction 2) -> Raspberry Pi **GPIO 26** (Pin 37)
  - `OUT3 / OUT4` Screw Terminals -> Wing Mechanism Gearmotor

---

## 🐥 4. RELAYS & SMALL BIRDS MOTOR DRIVERS

### 2-Channel 5V Relay Module
- **VCC:** Raspberry Pi 5V (Pin 2 or 4)
- **GND:** Common GND Bus
- **Relay #1 IN:** Raspberry Pi **GPIO 17** (Pin 11) -> Switches Left Small Bird Chirp Circuit
- **Relay #2 IN:** Raspberry Pi **GPIO 27** (Pin 13) -> Switches Right Small Bird Chirp Circuit

### Center Small Bird Transistor / MOSFET Driver
- **Gate / Base Pin:** Raspberry Pi **GPIO 22** (Pin 15)
- **Drain / Collector Pin:** Center Small Bird Beak & Body Gearmotor (-)
- **Source / Emitter Pin:** Common GND Bus

---

## ⚡ 5. POWER SUPPLY & SAFETY PRECAUTIONS

1. **Common Ground Connection:**
   - Connect the GND pins of Raspberry Pi, PCA9685, both L298N modules, Relay board, and external power supply to a shared common ground bus.

2. **Dedicated Servo Power Rail (V+):**
   - Servos require 10A - 12A continuous current. Do NOT draw servo power directly from Raspberry Pi pins!
   - Connect external 5V/6V High-Current Power Supply directly to the PCA9685 green screw terminal (`V+` and `GND`).

3. **Wire Color Guide:**
   - **RED:** +5V / +6V DC Power VCC
   - **BLACK:** Ground (GND)
   - **CYAN / BLUE:** I2C Bus & Parrot 2 Control Signals
   - **MAGENTA / PURPLE:** L298N #1 Motor Control
   - **GOLD / ORANGE:** Relay Triggers & Spotlights
   - **GREEN:** Center Small Bird Driver

---
*Created for the Animatronic Bird Show Master Animatronics Controller.*
