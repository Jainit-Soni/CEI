/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import { useRef, useState, useEffect, memo, useMemo } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import {
    useFBO,
    MeshTransmissionMaterial,
    Float,
    Instances,
    Instance,
    Text
} from '@react-three/drei';
import { easing } from 'maath';

export default function FluidGlass({
    style = {}
}) {
    // Mobile detection and SSR hydration protection
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mql = window.matchMedia("(max-width: 768px)");
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            setIsMobile(mql.matches || window.innerWidth <= 768 || (isTouch && window.innerWidth < 1024));
        };
        checkMobile();

        // Delay mounting until the CSS viewport has physically snapped to mobile dimensions, preventing Desktop FBO crashes
        const timer = setTimeout(() => {
            setIsMounted(true);
        }, 10);

        window.addEventListener('resize', checkMobile);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5, ...style }}>
            {isMounted && (
                <Canvas
                    camera={{ position: [0, 0, 20], fov: 15 }}
                    gl={{ antialias: true, stencil: false, depth: false }}
                    dpr={isMobile ? [1, 1] : [1, 2]}
                >
                    <LensScene isMobile={isMobile} />
                </Canvas>
            )}
        </div>
    );
}

// Removed DataRings per user request for a cleaner, ultra-minimalist focus on just the glass mask.


const LensScene = memo(function LensScene({ isMobile }) {
    const ref = useRef();
    const backgroundRef = useRef();
    const { viewport: vp, camera, pointer, gl, size } = useThree();

    // Dynamically match screen width to FBO, but cap it on mobile for hyper-performance
    const fboWidth = isMobile ? Math.min(size.width, 256) : size.width * 2;
    const fboHeight = isMobile ? Math.min(size.height, 256) : size.height * 2;

    const buffer = useFBO(
        fboWidth,
        fboHeight,
        {
            samples: isMobile ? 0 : 4, // Drop MSAA on mobile FBO completely
            depth: true,
            type: THREE.HalfFloatType
        }
    );

    const [scene] = useState(() => {
        const s = new THREE.Scene();
        // Pristine Light Theme Background for external canvas
        s.background = new THREE.Color('#f8fafc');
        return s;
    });

    // Sleek, minimal cylinder geometry for pure refraction power
    const fallbackGeometry = useMemo(() => new THREE.CylinderGeometry(1.2, 1.2, 0.1, 64), []);

    useFrame((state, delta) => {
        const { viewport } = state;
        const v = viewport.getCurrentViewport(camera, [0, 0, 5]);

        const destX = (pointer.x * v.width) / 2;
        const destY = (pointer.y * v.height) / 2;

        if (ref.current) {
            easing.damp3(ref.current.position, [destX, destY, 5], 0.1, delta);
            easing.damp3(ref.current.rotation, [Math.PI / 2 + pointer.y * 0.1, 0, -pointer.x * 0.1], 0.15, delta);

            // Fixed, elegant scale without massive scroll bloating
            const targetScale = isMobile ? 0.25 : 0.6;
            easing.damp(ref.current.scale, 'x', targetScale, 0.1, delta);
            easing.damp(ref.current.scale, 'y', targetScale, 0.1, delta);
            easing.damp(ref.current.scale, 'z', targetScale, 0.1, delta);
        }

        if (backgroundRef.current) {
            backgroundRef.current.rotation.y += 0.001;
            backgroundRef.current.rotation.x += 0.0005;
        }

        gl.setRenderTarget(buffer);
        gl.clear();
        gl.render(scene, camera);
        gl.setRenderTarget(null);
    });

    const innerContent = (
        <group position={[0, 0, 0]}>
            {/* Dark "X-Ray / Blueprint" cinematic backdrop INSIDE the lens */}
            <mesh ref={backgroundRef} scale={30}>
                <sphereGeometry args={[1, 64, 64]} />
                <meshBasicMaterial
                    side={THREE.BackSide}
                    color="#020617" /* Deep slate black */
                />
            </mesh>

            {/* Moody, intense lighting for the X-Ray mode */}
            <ambientLight intensity={0.5} color="#ffffff" />
            <pointLight position={[0, 0, 0]} intensity={2} color="#6366f1" />
            <pointLight position={[-10, 10, -5]} intensity={1.5} color="#ec4899" />

            {/* Central 3D Text - Huge, glowing, and pristine */}
            {!isMobile && (
                <Float speed={2} rotationIntensity={0.05} floatIntensity={0.1}>
                    <Text
                        position={[0, 0, -2]} // Sitting slightly back
                        fontSize={vp.width > 10 ? 1.5 : 1}
                        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf" // Crisp Sans
                        fontWeight={900}
                        letterSpacing={-0.02}
                        maxWidth={vp.width * 0.9}
                        lineHeight={0.9}
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                        color="#ffffff" // White text against dark background
                        fillOpacity={1}
                    >
                        INTELLIGENCE{"\n"}ENGINE
                    </Text>
                </Float>
            )}
        </group>
    );

    return (
        <>
            {createPortal(innerContent, scene)}

            <mesh scale={[vp.width, vp.height, 1]}>
                <planeGeometry />
                <meshBasicMaterial map={buffer.texture} transparent opacity={0} />
            </mesh>

            <mesh
                ref={ref}
                scale={isMobile ? 0.25 : 0.6}
                rotation-x={Math.PI / 2}
                geometry={fallbackGeometry}
                renderOrder={1}
            >
                {/* Enhanced Premium Glass Material - Lower IOR for legible text, high aberration for styling */}
                <MeshTransmissionMaterial
                    buffer={buffer.texture}
                    ior={1.1}
                    thickness={0.5}
                    anisotropy={isMobile ? 0.1 : 0.3}
                    chromaticAberration={0.06}
                    transmission={1}
                    roughness={0}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                    backside={false}
                    distortion={isMobile ? 0.1 : 0.2}
                    distortionScale={isMobile ? 0.1 : 0.3}
                    temporalDistortion={isMobile ? 0.0 : 0.1}
                    color="#ffffff"
                    transparent
                    opacity={1}
                    resolution={isMobile ? 128 : 1024}
                    samples={isMobile ? 0 : 8}
                />
            </mesh>
        </>
    );
});
