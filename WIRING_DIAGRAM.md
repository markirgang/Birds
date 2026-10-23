# 🦜 ANIMATRONIC BIRD SHOW - HARDWARE WIRING DIAGRAM & SCHEMATIC GUIDE

This document details all physical hardware connections, Raspberry Pi GPIO pin mappings, IRLZ44N N-Channel Logic-Level MOSFET spotlight circuits (with 220Ω series gate resistors and 10kΩ pull-down resistors), mechanical chirp relays, PCA9685 12-bit PWM channel assignments, L298N motor driver connections, and power distribution rails for the Animatronic Bird Show Master Controller.

---

## 📐 OVERVIEW OF SYSTEM HARDWARE ARCHITECTURE

```
+-----------------------------------------------------------------------------------+
|                                  MAIN POWER SUPPLY                                |
|  +12V DC @ 10A (IRLZ44N MOSFET Dimmable Stage Spotlights)                         |
|  +5V / +6V @ 12A DC (PCA9685 Servos & Gearmotors) +5V @ 3A DC (Raspberry Pi)      |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                              RASPBERRY PI 4 / 5 MCU                               |
| - 40-Pin GPIO Header                                                              |
| - I2C Bus (SDA: GPIO 2, SCL: GPIO 3) -> PCA9685 PWM Servo & MOSFET Controller    |
| - Mechanical Chirp Relays: GPIO 17 (Relay #1 Chirp), GPIO 27 (Relay #2 Chirp)     |
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
      v (PCA9685 PWM to IRLZ44N MOSFETs: 3.3V Gate / 12V Power)
+-----+----------------------+------------------------------------------------------+
|                       ANIMATRONIC STAGE ACTUATORS & LIGHTS                        |
| - Parrot 1 (Left Tall): 3-DOF Perch + 2-DOF Spotlight + Mouth/Eyes & Wing Motors  |
| - Parrot 2 (Right Tall): 3-DOF Perch + 2-DOF Spotlight + Mouth/Eyes & Wing Motors |
| - IRLZ44N Logic-Level MOSFET 12V DC Spotlights (220Ω Gate Resistor / 10kΩ GND):  |
|   * PCA Ch 5 -> 220Ω -> Gate IRLZ44N #1 -> 12V Parrot 1 LED Spotlight (-)         |
|   * PCA Ch 11 -> 220Ω -> Gate IRLZ44N #2 -> 12V Parrot 2 LED Spotlight (-)        |
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

## 🎛️ 2. PCA9685 16-CHANNEL PWM SERVO & MOSFET DRIVER (I2C Addr: 0x40)

| Channel # | Connected Servo / Hardware Output | Function Description | Signal Range & Voltage |
| :---: | :--- | :--- | :---: |
| **Ch 0** | Parrot 1 (Left) 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (5V) |
| **Ch 1** | Parrot 1 (Left) 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (5V) |
| **Ch 2** | Parrot 1 (Left) 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (5V) |
| **Ch 3** | Parrot 1 Spotlight | Horizontal Pan Servo Motor | 500μs - 2500μs (5V) |
| **Ch 4** | Parrot 1 Spotlight | Vertical Tilt Servo Motor | 500μs - 2500μs (5V) |
| **Ch 5** | Parrot 1 Spotlight LED MOSFET | **220Ω Gate Resistor (10kΩ GND) -> IRLZ44N -> 12V LED Spotlight (-)** | 0% - 100% PWM (12V) |
| **Ch 6** | Parrot 2 (Right) 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (5V) |
| **Ch 7** | Parrot 2 (Right) 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (5V) |
| **Ch 8** | Parrot 2 (Right) 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (5V) |
| **Ch 9** | Parrot 2 Spotlight | Horizontal Pan Servo Motor | 500μs - 2500μs (5V) |
| **Ch 10** | Parrot 2 Spotlight | Vertical Tilt Servo Motor | 500μs - 2500μs (5V) |
| **Ch 11** | Parrot 2 Spotlight LED MOSFET | **220Ω Gate Resistor (10kΩ GND) -> IRLZ44N -> 12V LED Spotlight (-)** | 0% - 100% PWM (12V) |
| **Ch 12** | Center Small Bird 3-DOF Perch | Turn Servo Motor (Yaw Angle) | 500μs - 2500μs (5V) |
| **Ch 13** | Center Small Bird 3-DOF Perch | Bow Servo Motor (Pitch Angle) | 500μs - 2500μs (5V) |
| **Ch 14** | Center Small Bird 3-DOF Perch | Shimmy Servo Motor (Roll Angle) | 500μs - 2500μs (5V) |
| **Ch 15** | Main Stage Turntable Base | Turntable Rotating Servo Motor | 500μs - 2500μs (Continuous) |

---

## ⚡ 3. IRLZ44N MOSFET LIGHTING CIRCUIT SCHEMATIC (GEMINI AI SPECIFICATION)

```
             PCA9685 PWM Output Channel Pin (PCA Ch 5 / Ch 11)
                                |
                                |
                             [220Ω Series Gate Resistor]
                                |
                                +-------------------+
                                |                   |
                          (Gate - Pin 1)     [10kΩ Pull-Down]
                          IRLZ44N MOSFET           |
                         +--------------+           |
                         |  G    D    S |           |
                         +--|----|----|-+           |
                            |    |    +-------------+----> Raspberry Pi GND &
                            |    |                         12V Power Supply (-) GND
                            |    |
                            |    +-----------------------> 12V DC Spotlight (-) Negative Wire
                            |
                   12V Spotlight (+) Positive Wire -----> +12V DC Power Supply (+) Rail
```

---

## ⚙️ 4. MECHANICAL CHIRP RELAYS & L298N MOTOR DRIVERS

### Mechanical Chirp Relays
- **Relay #1 (GPIO 17 Mechanical Relay):** Mechanical relay switching physical audio circuit for Front Left Small Bird chirp sound.
- **Relay #2 (GPIO 27 Mechanical Relay):** Mechanical relay switching physical audio circuit for Front Right Small Bird chirp sound.

### L298N Module #1 (Parrot 1 - Left Tall Parrot)
- **Power:** +12V/+5V Screw Terminal -> +5V/+6V High Current Power Rail | GND -> Common GND Bus
- **Channel A (Mouth & Blinking Eyes Actuator):**
  - `ENA` (PWM) -> GPIO 18 (Pin 12) | `IN1` -> GPIO 23 (Pin 16) | `IN2` -> GPIO 24 (Pin 18)
  - Forward Polarity (`IN1=HIGH, IN2=LOW`): Mouth Open
  - Reverse Polarity (`IN1=LOW, IN2=HIGH`): Eyes Blink
