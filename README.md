# 🌊 HYDROBOT Simulation

A real-time flood rescue detection robot simulation using thermal imaging sensors. This project simulates the HYDROBOT system described in your research documentation - a submersible robot designed to locate victims in flooded areas using thermal imaging technology.

## Features

### 🤖 Robot Capabilities

-   **Submersible Design**: Can dive and surface using ballast tanks
-   **Thermal Imaging**: Detects heat signatures of survivors, injured victims, and deceased bodies
-   **Sonar Navigation**: Avoids debris and obstacles underwater
-   **Multi-depth Search**: Operates at surface, shallow, medium, and deep water levels
-   **Real-time Data**: Transmits detection data to rescue teams

### 🌊 Water Environment

-   **Realistic Pool Environment**: Adjustable size and depth
-   **Water Turbidity**: Simulates murky flood water conditions
-   **Floating Debris**: Obstacles that the robot must navigate around
-   **Underwater Effects**: Bubbles, currents, and realistic lighting

### 🔍 Search Patterns

1. **Surface Sweep**: Grid pattern search at water surface
2. **Spiral Dive**: Spiral pattern with gradual depth increase
3. **Depth Layers**: Systematic layer-by-layer search
4. **Debris Navigation**: Optimized path around obstacles
5. **Thermal Tracking**: Focuses on detected heat signatures

### 🎯 Heat Signature Detection

-   **Human Survivor** (37°C) - Priority 1: Immediate rescue
-   **Injured Victim** (35°C) - Priority 2: Urgent medical attention
-   **Deceased Body** (28°C) - Priority 3: Recovery operation
-   **Trapped Animal** (39°C) - Priority 4: Animal rescue
-   **Submerged Vehicle** (22°C) - Check for occupants

## Controls

### Operation Modes

-   **Auto**: Autonomous search and rescue
-   **Manual**: Direct control (WASD + QE for depth)
-   **Rescue-Mode**: High priority victim search
-   **Deep-Search**: Extended depth search operations

### Manual Controls

-   **W/S**: Move forward/backward
-   **A/D**: Turn left/right
-   **Q/E**: Dive/surface
-   **Mouse**: Click and hold movement buttons

### Emergency Controls

-   **Emergency Dive**: Immediate descent to avoid surface hazards
-   **Emergency Surface**: Emergency ascent (low battery, malfunction)
-   **Reset Simulation**: Restart the entire simulation

## Technical Specifications

### Sensors

-   **Thermal Detection Range**: 8m (affected by water turbidity)
-   **Sonar Range**: 10m with 60 rays
-   **Maximum Dive Depth**: 6m
-   **Battery Life**: Decreases during operation

### Performance Metrics

-   **Victims Found**: Number of survivors located
-   **Area Searched**: Percentage of search area covered
-   **Heat Detection Status**: Real-time thermal scanning
-   **Battery Level**: Current power remaining
-   **Water Depth**: Current submersion level

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
    - Choose operation mode (Auto/Manual/Rescue/Deep-Search)
    - Select search pattern
    - Adjust environment parameters
    - Watch the HYDROBOT locate victims!

## Simulation Tips

1. **Start with Surface Sweep**: Good for initial reconnaissance
2. **Use Rescue Mode**: When you need to prioritize human survivors
3. **Monitor Battery**: Emergency surface when battery is low
4. **Adjust Turbidity**: Higher turbidity reduces thermal detection range
5. **Watch for Debris**: Robot will automatically avoid obstacles
6. **Check Heat Signatures**: Different colors indicate different types of victims

## Educational Value

This simulation demonstrates:

-   Real-world robotics applications in disaster response
-   Thermal imaging technology principles
-   Autonomous navigation and path planning
-   Human-robot interaction in emergency scenarios
-   The importance of technology in saving lives

## Future Enhancements

-   Water current simulation
-   Multi-robot coordination
-   Advanced AI for victim prioritization
-   Virtual reality integration
-   Real-time weather effects

---

_Based on the HYDROBOT research project for flood rescue detection using thermal imaging sensors._
