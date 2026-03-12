/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import { useRef, useState, useEffect, memo, useMemo } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import {
    useFBO,
    MeshTransmissionMaterial,
    Float,
    Text
} from '@react-three/drei';
import { easing } from 'maath';

const BASE_INTELLIGENCE_STATES = [
    "INTELLIGENCE\nENGINE",
    "REAL-TIME\nSIGNALS",
    "STRUCTURED\nCLARITY",
    "DECISION\nLAYER",
    "AXIOM CORE",
    "DATA\nREFRACTION",
    "NEURAL PATHS",
    "HIGH-FIDELITY\nINTEL",
    "SYSTEM\nSYNTHESIS",
    "PURE\nANALYTICS"
];

export default function FluidGlass({
    style = {},
    progress = 0
}) {
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        setIsMounted(true);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 100, ...style }}>
            {isMounted && (
                <Canvas
                    camera={{ position: [0, 0, 20], fov: 15 }}
                    gl={{ antialias: true, stencil: false, depth: false, powerPreference: "high-performance" }}
                    dpr={isMobile ? [1, 1] : [1, 1.5]}
                >
                    <ambientLight intensity={1.5} color="#ffffff" />
                    <pointLight position={[0, 10, 15]} intensity={1} color="#ffffff" />
                    <LensScene isMobile={isMobile} progress={progress} />
                </Canvas>
            )}
        </div>
    );
}

const LensScene = memo(function LensScene({ isMobile, progress }) {
    const ref = useRef();
    const mouse = useRef({ x: 0, y: 0 });
    const { camera, gl, size } = useThree();

    const randomizedStates = useMemo(() => {
        return [...BASE_INTELLIGENCE_STATES].sort(() => 0.5 - Math.random());
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const buffer = useFBO(size.width * 1.5, size.height * 1.5, {
        samples: isMobile ? 0 : 2,
        depth: true,
        type: THREE.HalfFloatType
    });

    const [scene] = useState(() => {
        const s = new THREE.Scene();
        s.background = new THREE.Color('#ffffff'); 
        return s;
    });

    const fallbackGeometry = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);

    const activeStateIndex = Math.min(randomizedStates.length - 1, Math.floor(progress * (randomizedStates.length - 1)));
    const activeText = randomizedStates[activeStateIndex];

    useFrame((state, delta) => {
        const { viewport } = state;
        const v = viewport.getCurrentViewport(camera, [0, 0, 5]);

        const destX = (mouse.current.x * v.width) / 2.2;
        const destY = (mouse.current.y * v.height) / 2.2 + (progress * 5);

        if (ref.current) {
            easing.damp3(ref.current.position, [destX, destY, 5], 0.2, delta);
            easing.damp3(ref.current.rotation, [Math.PI / 2 + mouse.current.y * 0.05, 0, -mouse.current.x * 0.05], 0.3, delta);

            const scalePulse = 0.6 + Math.sin(progress * Math.PI) * 0.05;
            easing.damp3(ref.current.scale, [scalePulse, scalePulse, scalePulse], 0.2, delta);
        }

        gl.setRenderTarget(buffer);
        gl.clear();
        gl.render(scene, camera);
        gl.setRenderTarget(null);
    });

    const innerContent = (
        <group position={[0, 0, 0]}>
            <ambientLight intensity={2.5} color="#ffffff" />
            <pointLight position={[0, 5, 5]} intensity={1.5} color="#ffffff" />
            
            <Float speed={isMobile ? 0.5 : 0.8} rotationIntensity={0.02} floatIntensity={0.05}>
                <Text
                    position={[0, 0, -1]}
                    fontSize={isMobile ? 0.6 : 1.0} 
                    maxWidth={isMobile ? 4 : 12}  
                    font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf"
                    fontWeight={900}
                    letterSpacing={-0.02}
                    lineHeight={1}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#0f172a"
                    fillOpacity={1} // Instant visibility on mount
                >
                    {activeText}
                </Text>
            </Float>
        </group>
    );

    return (
        <>
            {createPortal(innerContent, scene)}

            <mesh
                ref={ref}
                scale={isMobile ? 0.35 : 0.6}
                rotation-x={Math.PI / 2}
                geometry={fallbackGeometry}
            >
                <MeshTransmissionMaterial
                    buffer={buffer.texture}
                    backside
                    thickness={1}
                    chromaticAberration={0.005}
                    anisotropy={0.1}
                    distortion={0.01}
                    distortionScale={0.01}
                    temporalDistortion={0.1}
                    transmission={1.0}
                    samples={isMobile ? 2 : 8}
                    background={new THREE.Color('#ffffff')}
                    color="#ffffff"
                    roughness={0}
                    ior={1.05}
                />
            </mesh>
        </>
    );
});
