export const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldNormal;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const earthFragmentShader = `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldNormal;
  
  void main() {
    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;
    
    // Use world normal for sun calculation
    vec3 normal = normalize(vWorldNormal);
    vec3 sunDir = normalize(sunDirection);
    float sunDot = dot(normal, sunDir);
    
    // Smooth transition from night to day using smoothstep(-0.1, 0.1, ...)
    float dayNightMix = smoothstep(-0.1, 0.1, sunDot);
    
    // Enhance city lights - boost brightness and add warm glow
    float lightIntensity = length(nightColor);
    vec3 cityLights = nightColor * 2.5;
    // Add warm orange/yellow tint to city lights
    cityLights += vec3(0.4, 0.25, 0.1) * lightIntensity * 1.5;
    
    // Dark base for night side (ocean/land without lights)
    vec3 nightBase = vec3(0.02, 0.03, 0.05);
    vec3 nightSide = nightBase + cityLights;
    
    // Apply day lighting with diffuse shading
    float diffuse = max(0.0, sunDot);
    vec3 daySide = dayColor * (0.3 + 0.7 * diffuse);
    
    // Mix day and night based on sun position
    vec3 color = mix(nightSide, daySide, dayNightMix);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
