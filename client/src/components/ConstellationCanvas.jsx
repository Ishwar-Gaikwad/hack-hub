import React, { useEffect, useRef } from 'react';

const FRAME_INTERVAL = 1000 / 30;
const MAX_NODES = 125;

export default function ConstellationCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return undefined;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: -1000, y: -1000, energy: 0 };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let gridSpacing = 178;
    let nodes = [];
    let frameId = null;
    let lastFrameTime = 0;
    let staticTime = 0;

    const gridKey = (row, column) => `${row}:${column}`;

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      let spacing = width < 600 ? 142 : 178;
      let columns = Math.ceil(width / spacing) + 1;
      let rows = Math.ceil(height / spacing) + 1;
      const estimatedNodeCount = (columns + 2) * (rows + 2);
      if (estimatedNodeCount > MAX_NODES) {
        spacing *= Math.sqrt(estimatedNodeCount / MAX_NODES) * 1.03;
        columns = Math.ceil(width / spacing) + 1;
        rows = Math.ceil(height / spacing) + 1;
      }
      gridSpacing = spacing;
      const positions = [];

      for (let row = -1; row < rows && positions.length < MAX_NODES; row += 1) {
        for (let column = -1; column < columns && positions.length < MAX_NODES; column += 1) {
          const stagger = row % 2 === 0 ? 0 : spacing / 2;
          positions.push({
            row,
            column,
            x: column * spacing + stagger + spacing / 2,
            y: row * spacing + spacing / 2,
            phase: (row * 7 + column * 13) * 0.37
          });
        }
      }

      nodes = positions;
      render(staticTime, motionPreference.matches);
    };

    const render = (time, isStatic = false) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const seconds = isStatic ? 0 : time / 1000;
      const shockRadius = 34 + (1 - pointer.energy) * 88;
      const visibleNodes = nodes.map((node) => {
        const driftX = isStatic ? 0 : Math.sin(seconds * 0.36 + node.phase) * 3.2;
        const driftY = isStatic ? 0 : Math.cos(seconds * 0.31 + node.phase * 0.8) * 3.2;
        const dx = node.x - pointer.x;
        const dy = node.y - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let pushX = 0;
        let pushY = 0;

        if (!isStatic && pointer.energy > 0.01 && distance < shockRadius && distance > 0) {
          const force = (1 - distance / shockRadius) * pointer.energy * 18;
          pushX = (dx / distance) * force;
          pushY = (dy / distance) * force;
        }

        return {
          ...node,
          drawX: node.x + driftX + pushX,
          drawY: node.y + driftY + pushY,
          distanceToPointer: distance
        };
      });
      const drawNodeByGrid = new Map(visibleNodes.map((node) => [gridKey(node.row, node.column), node]));
      const linkDistance = gridSpacing * 1.42;

      context.lineWidth = 0.8;
      visibleNodes.forEach((node) => {
        const neighbors = [
          [node.row, node.column + 1],
          [node.row + 1, node.column - 1],
          [node.row + 1, node.column],
          [node.row + 1, node.column + 1]
        ];

        neighbors.forEach(([row, column]) => {
          const neighbor = drawNodeByGrid.get(gridKey(row, column));
          if (!neighbor) return;
          const dx = node.drawX - neighbor.drawX;
          const dy = node.drawY - neighbor.drawY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > linkDistance) return;

          const nearbyPointer = Math.min(node.distanceToPointer, neighbor.distanceToPointer) < shockRadius;
          context.strokeStyle = nearbyPointer
            ? `rgba(220, 120, 255, ${0.26 * (1 - distance / linkDistance)})`
            : `rgba(167, 139, 250, ${0.13 * (1 - distance / linkDistance)})`;
          context.beginPath();
          context.moveTo(node.drawX, node.drawY);
          context.lineTo(neighbor.drawX, neighbor.drawY);
          context.stroke();
        });
      });

      visibleNodes.forEach((node) => {
        const highlighted = !isStatic && node.distanceToPointer < shockRadius;
        const alpha = highlighted ? 0.8 : 0.38;
        const radius = highlighted ? 1.8 : 1.25;
        context.fillStyle = highlighted
          ? `rgba(236, 72, 153, ${alpha})`
          : `rgba(192, 132, 252, ${alpha})`;
        context.beginPath();
        context.arc(node.drawX, node.drawY, radius, 0, Math.PI * 2);
        context.fill();
      });

      if (!isStatic && pointer.energy > 0.02) {
        context.strokeStyle = `rgba(192, 132, 252, ${pointer.energy * 0.15})`;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(pointer.x, pointer.y, shockRadius, 0, Math.PI * 2);
        context.stroke();
        pointer.energy *= 0.93;
      } else {
        pointer.energy = 0;
      }
    };

    const animate = (time) => {
      frameId = window.requestAnimationFrame(animate);
      if (time - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = time;
      staticTime = time;
      render(time);
    };

    const handlePointerMove = (event) => {
      if (event.pointerType === 'touch') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.energy = 1;
    };

    const handleMotionPreference = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      window.removeEventListener('pointermove', handlePointerMove);

      if (motionPreference.matches) {
        pointer.energy = 0;
        render(0, true);
        return;
      }

      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      lastFrameTime = 0;
      frameId = window.requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    motionPreference.addEventListener('change', handleMotionPreference);
    handleMotionPreference();

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handlePointerMove);
      motionPreference.removeEventListener('change', handleMotionPreference);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-constellation-canvas" aria-hidden="true" />;
}
