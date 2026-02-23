/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import { useRef, useState, useEffect, memo, useMemo } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import {
    useFBO,
    MeshTransmissionMaterial,
    Text,
    Float
} from '@react-three/drei';
import { easing } from 'maath';

export default function FluidGlass({
    title = "Discover. Rank. Hype.",
    style = {}
}) {
    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5, ...style }}>
            <Canvas
                camera={{ position: [0, 0, 20], fov: 15 }}
                gl={{ alpha: true, antialias: true, stencil: false, depth: false }}
                dpr={[1, 2]}
            >
                <ambientLight intensity={1.5} />
                <pointLight position={[10, 10, 20]} intensity={1} />
                <LensScene title="CE — Intelligence" />
            </Canvas>
        </div>
    );
}

const LensScene = memo(function LensScene({ title }) {
    const ref = useRef();
    const textRef = useRef();
    const { viewport: vp, camera, pointer, gl } = useThree();
    const buffer = useFBO();

    const [scene] = useState(() => {
        const s = new THREE.Scene();
        s.background = null;
        return s;
    });

    // Fallback Geometry: A thin cylinder (disc) for the lens
    const fallbackGeometry = useMemo(() => new THREE.CylinderGeometry(1.2, 1.2, 0.1, 64), []);

    useFrame((state, delta) => {
        const { viewport } = state;
        const v = viewport.getCurrentViewport(camera, [0, 0, 5]);

        const destX = (pointer.x * v.width) / 2;
        const destY = (pointer.y * v.height) / 2;

        if (ref.current) {
            easing.damp3(ref.current.position, [destX, destY, 5], 0.1, delta);
            easing.damp3(ref.current.rotation, [Math.PI / 2 + pointer.y * 0.1, 0, -pointer.x * 0.1], 0.15, delta);
        }

        gl.setRenderTarget(buffer);
        gl.setClearColor(0xffffff, 0); // Ensure transparent clear
        gl.clear();
        gl.render(scene, camera);
        gl.setRenderTarget(null);
    });

    return (
        <>
            {createPortal(
                <group position={[0, 0, 0]}> {/* Centered for better lens tracking */}
                    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
                        <Text
                            ref={textRef}
                            fontSize={vp.width > 10 ? 2 : 1.4} // Slightly larger for clarity
                            maxWidth={vp.width * 0.9}
                            lineHeight={1}
                            textAlign="center"
                            anchorX="center"
                            anchorY="middle"
                            color="#3730a3" // Deeper, more saturated indigo for better contrast
                        >
                            {title}
                        </Text>
                    </Float>
                </group>,
                scene
            )}

            <mesh scale={[vp.width, vp.height, 1]}>
                <planeGeometry />
                <meshBasicMaterial map={buffer.texture} transparent opacity={0} />
            </mesh>

            <mesh
                ref={ref}
                scale={0.35} // Slightly increased from 0.22
                rotation-x={Math.PI / 2}
                geometry={fallbackGeometry}
                renderOrder={1}
            >
                <MeshTransmissionMaterial
                    buffer={buffer.texture}
                    ior={1.15}
                    thickness={0.3} // Further reduced for clarity
                    anisotropy={0.1}
                    chromaticAberration={0.02}
                    transmission={1}
                    roughness={0.01}
                    backside={true}
                    distortion={0.1}
                    distortionScale={0.2}
                    temporalDistortion={0.05}
                    color="#ffffff" // Pure white for max crystalline effect
                    transparent
                    opacity={1}
                />
            </mesh>
        </>
    );
});
