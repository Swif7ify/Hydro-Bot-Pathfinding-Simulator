# 🌊 HYDROBOT Pathfinding Simulator

A real-time underwater rescue detection robot simulation featuring advanced sonar navigation and thermal imaging sensors. This project simulates the HYDROBOT system - a submersible autonomous underwater vehicle (AUV) designed to locate victims in flooded areas using cutting-edge sensor technology and intelligent pathfinding algorithms.

## Features

### 🤖 Robot Capabilities

-   **Advanced AUV Design**: Realistic underwater vehicle with sophisticated movement dynamics
-   **Thermal Imaging**: Detects heat signatures of survivors, injured victims, and deceased bodies
-   **Visual Sonar System**: Real-time 3D sonar visualization with object detection wireframes
-   **Intelligent Pathfinding**: Autonomous navigation with obstacle avoidance
-   **Multi-depth Operations**: Surface, shallow, medium, and deep water search capabilities
-   **Real-time Data Transmission**: Live sensor data streaming to rescue coordination centers
-   **Automatic Target Collection**: Proximity-based victim rescue within 2-meter range
-   **Dynamic Environmental Events**: Realistic underwater conditions and marine life interactions

### 🎥 Camera Views

-   **Optical Mode**: Standard underwater camera view with realistic lighting and water effects
-   **Sonar Mode**: Advanced 3D sonar visualization with color-coded object detection wireframes
-   **Seamless Switching**: Toggle between optical and sonar modes with consistent scene rendering

### 🌊 Underwater Environment

-   **Realistic Flooded City**: Detailed urban environment with submerged buildings, vehicles, and debris
-   **Dynamic Water Effects**: Advanced underwater lighting, particle systems, and water turbidity simulation
-   **Floating Debris Field**: Complex obstacle course requiring intelligent navigation
-   **Environmental Hazards**: Realistic underwater conditions affecting AUV performance
-   **Marine Life**: Dynamic sea creatures that interact with sonar systems during interference events

### 🔍 Search & Navigation Systems

1. **Autonomous Pathfinding**: AI-driven navigation with dynamic obstacle avoidance
2. **Grid Pattern Search**: Systematic area coverage for comprehensive victim location
3. **Intelligent Depth Management**: Automatic depth adjustment based on environment conditions
4. **Collision Avoidance**: Real-time obstacle detection and path replanning
5. **Heat Signature Tracking**: Thermal-guided navigation toward potential victims
6. **Marine Life Awareness**: Advanced detection of biological interference

### ⚡ Dynamic Environmental Events

The simulation includes realistic underwater events that affect AUV operations:

-   **High Current**: Strong underwater currents affecting movement and navigation
-   **Low Visibility**: Reduced optical visibility due to sediment or algae blooms
-   **Thermal Layers**: Temperature differences affecting sonar accuracy and detection
-   **Magnetic Interference**: Compass and navigation system disruptions
-   **Equipment Malfunction**: Temporary system failures (sonar, navigation, propulsion, lights)
-   **Marine Life Interference**: Realistic sea creatures appearing during biological activity
-   **Underwater Storm**: Turbulence causing erratic movement and reduced control

### 🎯 Advanced Detection & Collection Systems

-   **Human Survivor** (37°C) - Priority 1: Immediate rescue with emergency beacon activation
-   **Injured Victim** (35°C) - Priority 2: Urgent medical attention with location marking
-   **Deceased Body** (28°C) - Priority 3: Recovery operation with respectful handling protocols
-   **Trapped Animal** (39°C) - Priority 4: Animal rescue with specialized collection procedures
-   **Submerged Vehicle** (22°C) - Priority 5: Vehicle inspection for potential occupants

**Advanced Collection System**:

-   **Proximity Detection**: Automatic collection when approaching within 2 meters
-   **Visual Effects**: Dynamic particle systems and color-coded collection animations
-   **Status Updates**: Real-time mission progress and rescue statistics
-   **Intelligent Prioritization**: AI-driven target selection based on urgency and thermal signatures

## Controls & Operation

### Control Modes

-   **Manual Mode**: Direct AUV control with full freedom of movement
-   **Free Camera**: Detached camera for cinematic viewing and analysis
-   **Collision Detection**: Real-time obstacle avoidance and damage assessment

### Manual Controls

-   **W/S**: Move forward/backward
-   **A/D**: Turn left/right
-   **Q/E**: Dive/surface (depth control)
-   **C**: Toggle between Manual AUV control and Free Camera mode
-   **V**: Switch between Optical and Sonar camera modes
-   **H**: Toggle collision detection wireframe visualization
-   **Mouse**: Free camera look controls (when in Free Camera mode)

### Camera System

-   **Optical Mode**: Realistic underwater view with natural lighting and water effects
-   **Sonar Mode**: Advanced 3D sonar visualization with:
    -   Color-coded object wireframes based on distance and type
    -   Real-time object detection and classification
    -   Consistent scene background and lighting
    -   Dynamic environmental effects

### Target Interaction

-   **Automatic Detection**: Thermal and sonar sensors continuously scan for targets
-   **Proximity Collection**: Approach within 2 meters for automatic victim rescue
-   **Visual Feedback**: Particle effects and color-coded animations during collection
-   **Mission Tracking**: Real-time statistics on rescue progress and area coverage

## Technical Specifications

### Advanced Sensor Systems

-   **Thermal Detection Range**: 8-15m range (affected by water conditions and turbidity)
-   **3D Sonar Visualization**: Real-time object detection with color-coded wireframe rendering
-   **Maximum Operating Depth**: 15m with full sensor capability
-   **Collision Detection**: Multi-directional impact assessment with damage visualization
-   **Environmental Sensors**: Water temperature, pressure, and current monitoring

### Performance Metrics & Monitoring

-   **Real-time Navigation Data**: Position, heading, speed, and depth tracking
-   **Search Efficiency**: Area coverage analysis and target detection statistics
-   **Environmental Conditions**: Water temperature, visibility, and turbidity measurements
-   **System Health**: Battery level, sensor status, and equipment functionality
-   **Event Logging**: Comprehensive record of collisions, rescues, and environmental events

### Simulation Features

-   **Physics Engine**: Realistic underwater movement dynamics and collision physics
-   **Dynamic Lighting**: Advanced underwater lighting with depth-based color filtering
-   **Particle Systems**: Bubbles, debris, and environmental effects
-   **Material Rendering**: PBR materials with realistic underwater appearance
-   **Event System**: Random environmental challenges and equipment malfunctions

## Research Context

This simulation is based on the HYDROBOT research project addressing flood rescue challenges in the Philippines:

### Problem Statement

-   Climate change has intensified flooding in the Philippines
-   Traditional rescue methods struggle in murky, debris-filled water
-   Zero visibility conditions make manual searches extremely difficult
-   Rescuers often don't know where to look for victims

### Solution Approach

-   Thermal imaging sensors can detect heat signatures through water
-   Submersible design allows operation in various water conditions
-   Autonomous search patterns maximize search efficiency
-   Real-time data transmission guides rescue operations

### Key Innovation

The HYDROBOT uses specially designed thermal sensors placed above the waterline but facing downward, allowing detection of heat signatures even in turbid water conditions.

## Getting Started

1. **Install Dependencies**:

    ```bash
    npm install
    ```

2. **Start Development Server**:

    ```bash
    npm run dev
    ```

3. **Open Browser**:
   Navigate to `http://localhost:5173/`

4. **Start Simulation**:
    - Use **Manual Mode** for direct AUV control
    - Switch to **Free Camera** mode for cinematic viewing
    - Toggle between **Optical** and **Sonar** modes to see different visualization systems
    - Navigate through the flooded city environment and locate thermal signatures
    - Watch for dynamic environmental events that affect AUV operations

## Simulation Guide

### Basic Operation

1. **Start with Manual Control**: Use WASD + QE to navigate the AUV through the underwater environment
2. **Toggle Camera Modes**: Press **V** to switch between Optical and Sonar visualization
3. **Monitor Environment**: Watch for environmental events that affect navigation and sensors
4. **Locate Targets**: Use thermal signatures and sonar detection to find victims and debris
5. **Collect Victims**: Approach within 2 meters of any target for automatic rescue collection

### Advanced Features

6. **Free Camera Mode**: Press **C** to detach camera for better environmental observation
7. **Collision Visualization**: Press **H** to see wireframe hitboxes for all objects
8. **Environmental Events**: Experience realistic underwater conditions like currents, visibility changes, and marine life interference
9. **Dynamic Sonar**: Watch object wireframes appear and fade in sonar mode based on distance and detection
10. **Mission Analysis**: Monitor rescue statistics and area coverage in real-time

## Educational Value & Applications

This simulation demonstrates advanced concepts in:

### Robotics & Engineering

-   **Autonomous Underwater Vehicle (AUV) Design**: Realistic movement dynamics and sensor integration
-   **Sensor Fusion**: Combining thermal imaging and sonar data for comprehensive environmental awareness
-   **Pathfinding Algorithms**: AI-driven navigation with dynamic obstacle avoidance
-   **Real-time Data Processing**: Live sensor data interpretation and decision making
-   **Human-Robot Interaction**: Intuitive control systems for emergency response operations

### Computer Graphics & Simulation

-   **3D Underwater Rendering**: Advanced lighting, water effects, and particle systems
-   **Physics Simulation**: Realistic collision detection and underwater movement dynamics
-   **Dynamic Event Systems**: Procedural environmental challenges and equipment failures
-   **User Interface Design**: Mission-critical information display and control systems

### Emergency Response & Disaster Management

-   **Search and Rescue Operations**: Systematic victim location and extraction procedures
-   **Thermal Imaging Applications**: Heat signature detection in challenging environments
-   **Environmental Hazard Management**: Operating in unpredictable underwater conditions
-   **Technology in Disaster Response**: The role of advanced robotics in saving lives

## Research Applications

This simulation supports research in:

-   **Flood Rescue Technology**: Advanced sensor systems for victim detection in turbid water
-   **Autonomous Navigation**: AI pathfinding in complex, debris-filled environments
-   **Marine Robotics**: AUV design and operation in challenging underwater conditions
-   **Human-Computer Interaction**: Interface design for emergency response systems
-   **Environmental Monitoring**: Real-time assessment of underwater conditions and hazards

## Future Development

### Planned Enhancements

-   **Multi-AUV Coordination**: Fleet operations with distributed search patterns
-   **Advanced AI Behaviors**: Machine learning for improved victim prioritization
-   **Virtual Reality Integration**: Immersive operator training and remote piloting
-   **Enhanced Physics**: Advanced fluid dynamics and underwater current simulation
-   **Expanded Environments**: Different disaster scenarios (tsunamis, storm surge, dam failures)

### Research Opportunities

-   **Sensor Technology**: Integration of new detection methods and sensors
-   **Communication Systems**: AUV-to-base data transmission in challenging conditions
-   **Power Management**: Battery optimization and charging strategies
-   **Rescue Protocols**: Development of automated victim extraction procedures
-   **Training Systems**: VR-based operator certification and skill development

---

## Project Context

This simulation is inspired by real-world flood rescue challenges in the Philippines and advances in autonomous underwater vehicle technology. The HYDROBOT concept addresses critical needs in disaster response, particularly in flood-prone regions where traditional rescue methods are limited by visibility and environmental conditions.

### Key Innovation

The simulation showcases the integration of thermal imaging sensors with advanced sonar systems, placed strategically on an AUV to detect heat signatures through turbid water conditions - a breakthrough approach for flood victim detection and rescue operations.

### Technical Foundation

Built with Vue.js 3, Three.js, and advanced WebGL rendering, this simulation provides a realistic and educational experience that bridges the gap between theoretical robotics concepts and practical emergency response applications.

---

_Advancing flood rescue technology through innovative AUV design and thermal imaging sensor integration._
