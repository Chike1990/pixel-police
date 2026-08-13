import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

const Canvas = styled.canvas<{ $active: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
  visibility: ${({ $active }) => ($active ? 'visible' : 'hidden')};
  background: linear-gradient(to right, rgba(124, 92, 255, 0.4), rgba(255, 92, 124, 0.6));
  backdrop-filter: blur(2px);
`

const WidgetContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: all;
  min-width: 220px;
`

const ToggleHeader = styled.button`
  background: transparent;
  border: none;
  width: 100%;
  padding: 12px 24px;
  color: black;
  font-size: 14px;
  font-weight: 900;
  font-style: italic;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  line-height: 1;
  transition: background 0.1s;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  
  &:active {
    background: rgba(0, 0, 0, 0.1);
  }
`

export function PixelPolice() {
  const [active, setActive] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const setSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    setSize()
    window.addEventListener('resize', setSize)

    return () => window.removeEventListener('resize', setSize)
  }, [])

  useEffect(() => {
    document.body.style.cursor = active ? 'crosshair' : ''

    return () => {
      document.body.style.cursor = ''
    }
  }, [active])

  const handleToggle = () => setActive((prev) => !prev)

  return (
    <>
      <Canvas ref={canvasRef} $active={active} data-pixel-police />

      <WidgetContainer data-pixel-police>
        <ToggleHeader
          onClick={handleToggle}
          aria-label={active ? 'Deactivate Pixel Police' : 'Activate Pixel Police'}
          title="Pixel Police (Esc to close)"
        >
          🚨 PIXEL POLICE 🚨
        </ToggleHeader>
      </WidgetContainer>
    </>
  )
}