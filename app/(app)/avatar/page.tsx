'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, RotateCcw, Copy, Pipette } from 'lucide-react'
import Link from 'next/link'

type ShapeType = 'circle' | 'rect' | 'triangle' | 'star' | 'diamond' | 'heart'

interface Layer {
  id: string
  type: ShapeType
  x: number
  y: number
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  rotation: number
}

const COLORS = [
  '#fbbf24','#f87171','#34d399','#60a5fa','#a78bfa','#fb7185',
  '#38bdf8','#4ade80','#f97316','#e879f9','#ffffff','#111111',
  '#1e293b','#dc2626','#16a34a','#2563eb','#7c3aed','#db2777',
]

const SHAPE_ICONS: Record<ShapeType, string> = {
  circle: '⬤', rect: '■', triangle: '▲', star: '★', diamond: '◆', heart: '♥'
}

const DEFAULT_LAYERS: Layer[] = [
  { id: 'bg', type: 'circle', x: 2, y: 2, w: 96, h: 96, fill: '#1e293b', stroke: 'transparent', strokeWidth: 0, opacity: 1, rotation: 0 },
]

function genId() { return Math.random().toString(36).slice(2, 9) }

// Serialize layers to SVG string for storage/display
function layersToSVG(layers: Layer[]): string {
  const shapes = layers.map(l => {
    const cx = l.x + l.w / 2
    const cy = l.y + l.h / 2
    const transform = l.rotation !== 0 ? ` transform="rotate(${l.rotation},${cx},${cy})"` : ''
    const common = `fill="${l.fill}" stroke="${l.stroke === 'transparent' ? 'none' : l.stroke}" stroke-width="${l.strokeWidth}" opacity="${l.opacity}"${transform}`

    switch (l.type) {
      case 'circle':
        return `<ellipse cx="${cx}" cy="${cy}" rx="${l.w/2}" ry="${l.h/2}" ${common}/>`
      case 'rect':
        return `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="3" ${common}/>`
      case 'triangle':
        return `<polygon points="${cx},${l.y} ${l.x+l.w},${l.y+l.h} ${l.x},${l.y+l.h}" ${common}/>`
      case 'diamond':
        return `<polygon points="${cx},${l.y} ${l.x+l.w},${cy} ${cx},${l.y+l.h} ${l.x},${cy}" ${common}/>`
      case 'star': {
        const pts = []
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2
          const r = i % 2 === 0 ? Math.min(l.w, l.h) / 2 : Math.min(l.w, l.h) / 4
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
        }
        return `<polygon points="${pts.join(' ')}" ${common}/>`
      }
      case 'heart': {
        const s = Math.min(l.w, l.h)
        return `<path d="M${cx},${l.y+s*0.35} C${cx},${l.y+s*0.1} ${l.x},${l.y+s*0.1} ${l.x},${l.y+s*0.35} C${l.x},${l.y+s*0.6} ${cx},${l.y+s*0.8} ${cx},${l.y+l.h} C${cx},${l.y+s*0.8} ${l.x+l.w},${l.y+s*0.6} ${l.x+l.w},${l.y+s*0.35} C${l.x+l.w},${l.y+s*0.1} ${cx},${l.y+s*0.1} ${cx},${l.y+s*0.35} Z" ${common}/>`
      }
    }
  }).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">\n${shapes}\n</svg>`
}

// Try to parse saved SVG back. If it fails or is missing, use defaults.
// We store layers as JSON in a comment inside the SVG for round-tripping.
function svgWithLayers(layers: Layer[]): string {
  const json = JSON.stringify(layers)
  const svg = layersToSVG(layers)
  // Inject layers as a comment so we can restore them
  return svg.replace('</svg>', `<!-- LAYERS:${btoa(json)} -->\n</svg>`)
}

function parseLayers(svg: string | null | undefined): Layer[] | null {
  if (!svg) return null
  const match = svg.match(/<!-- LAYERS:([A-Za-z0-9+/=]+) -->/)
  if (!match) return null
  try {
    return JSON.parse(atob(match[1]))
  } catch {
    return null
  }
}

export default function AvatarEditorPage() {
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  // Drag state
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; origLayer: Layer } | null>(null)
  const supabase = createClient()

  // Load existing avatar on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('avatar_svg').eq('id', user.id).single()
      if (profile?.avatar_svg) {
        const parsed = parseLayers(profile.avatar_svg)
        if (parsed && parsed.length > 0) {
          setLayers(parsed)
          setSelected(null)
        }
      }
      setLoaded(true)
    }
    load()
  }, [])

  const selectedLayer = layers.find(l => l.id === selected) ?? null

  // Convert SVG coordinate to canvas 0-100 space
  function toSVGCoords(e: React.MouseEvent | MouseEvent): { x: number; y: number } {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }

  function activateEyedropper() {
    if (!('EyeDropper' in window)) {
      alert('La pipette nécessite Chrome/Edge 95+')
      return
    }
    setEyedropperActive(true)
    const dropper = new (window as any).EyeDropper()
    dropper.open().then((result: any) => {
      if (selected) updateLayer(selected, { fill: result.sRGBHex })
      setEyedropperActive(false)
    }).catch(() => setEyedropperActive(false))
  }

    function startDrag(e: React.MouseEvent, id: string, mode: 'move' | 'resize') {
    e.stopPropagation()
    e.preventDefault()
    setSelected(id)
    const layer = layers.find(l => l.id === id)!
    const { x, y } = toSVGCoords(e)
    dragRef.current = { id, mode, startX: x, startY: y, origLayer: { ...layer } }
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const { x, y } = toSVGCoords(e as any)
    const dx = x - drag.startX
    const dy = y - drag.startY

    setLayers(prev => prev.map(l => {
      if (l.id !== drag.id) return l
      const o = drag.origLayer
      if (drag.mode === 'move') {
        return {
          ...l,
          x: Math.max(0, Math.min(100 - o.w, o.x + dx)),
          y: Math.max(0, Math.min(100 - o.h, o.y + dy)),
        }
      } else {
        // resize: drag bottom-right handle
        const newW = Math.max(5, o.w + dx)
        const newH = Math.max(5, o.h + dy)
        return { ...l, w: Math.min(newW, 100 - o.x), h: Math.min(newH, 100 - o.y) }
      }
    }))
  }, [])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  function addLayer(type: ShapeType) {
    const id = genId()
    const newLayer: Layer = {
      id, type,
      x: 20, y: 20, w: 40, h: 40,
      fill: COLORS[Math.floor(Math.random() * 10)],
      stroke: 'transparent', strokeWidth: 0,
      opacity: 1, rotation: 0,
    }
    setLayers(prev => [...prev, newLayer])
    setSelected(id)
  }

  function updateLayer(id: string, changes: Partial<Layer>) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l))
  }

  function deleteLayer(id: string) {
    setLayers(prev => prev.filter(l => l.id !== id))
    setSelected(null)
  }

  function duplicateLayer(id: string) {
    const layer = layers.find(l => l.id === id)
    if (!layer) return
    const newId = genId()
    const duplicate = { ...layer, id: newId, x: layer.x + 5, y: layer.y + 5 }
    setLayers(prev => [...prev, duplicate])
    setSelected(newId)
  }

  function moveLayerOrder(id: string, dir: 'up' | 'down') {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id)
      const arr = [...prev]
      if (dir === 'up' && idx < arr.length - 1) [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]]
      if (dir === 'down' && idx > 0) [arr[idx], arr[idx-1]] = [arr[idx-1], arr[idx]]
      return arr
    })
  }

  async function handleSave() {
    setSaving(true)
    const svg = svgWithLayers(layers)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ avatar_svg: svg }).eq('id', user.id)
    }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-2 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
      </div>
    )
  }

  // Render a shape in the SVG canvas
  function renderShape(l: Layer, isSelected: boolean) {
    const cx = l.x + l.w / 2
    const cy = l.y + l.h / 2
    const transform = l.rotation !== 0 ? `rotate(${l.rotation},${cx},${cy})` : undefined
    const commonProps = {
      fill: l.fill,
      stroke: isSelected ? '#fbbf24' : (l.stroke === 'transparent' ? 'none' : l.stroke),
      strokeWidth: isSelected ? 0.8 : l.strokeWidth,
      opacity: l.opacity,
      transform,
      style: { cursor: 'move' },
      onMouseDown: (e: React.MouseEvent) => startDrag(e, l.id, 'move'),
    }

    switch (l.type) {
      case 'circle':
        return <ellipse key={l.id} cx={cx} cy={cy} rx={l.w/2} ry={l.h/2} {...commonProps} />
      case 'rect':
        return <rect key={l.id} x={l.x} y={l.y} width={l.w} height={l.h} rx={3} {...commonProps} />
      case 'triangle':
        return <polygon key={l.id} points={`${cx},${l.y} ${l.x+l.w},${l.y+l.h} ${l.x},${l.y+l.h}`} {...commonProps} />
      case 'diamond':
        return <polygon key={l.id} points={`${cx},${l.y} ${l.x+l.w},${cy} ${cx},${l.y+l.h} ${l.x},${cy}`} {...commonProps} />
      case 'star': {
        const pts = []
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2
          const r = i % 2 === 0 ? Math.min(l.w, l.h)/2 : Math.min(l.w, l.h)/4
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
        }
        return <polygon key={l.id} points={pts.join(' ')} {...commonProps} />
      }
      case 'heart': {
        const s = Math.min(l.w, l.h)
        const d = `M${cx},${l.y+s*0.35} C${cx},${l.y+s*0.1} ${l.x},${l.y+s*0.1} ${l.x},${l.y+s*0.35} C${l.x},${l.y+s*0.6} ${cx},${l.y+s*0.8} ${cx},${l.y+l.h} C${cx},${l.y+s*0.8} ${l.x+l.w},${l.y+s*0.6} ${l.x+l.w},${l.y+s*0.35} C${l.x+l.w},${l.y+s*0.1} ${cx},${l.y+s*0.1} ${cx},${l.y+s*0.35} Z`
        return <path key={l.id} d={d} {...commonProps} />
      }
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/profil" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text">Éditeur d&apos;avatar</h1>
          <p className="text-cral-sub text-sm mt-1">Glissez les formes directement · Poignée en bas à droite pour redimensionner</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setLayers(DEFAULT_LAYERS); setSelected(null) }}
            className="btn-outline text-sm flex items-center gap-2 py-2">
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn-gold text-sm flex items-center gap-2 py-2">
            <Save size={14} />
            {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Canvas */}
        <div className="md:col-span-2 space-y-4">
          <div className="card p-4">
            {/* The canvas - square with clip circle to show final result */}
            <div className="flex gap-6 items-start">
              {/* Main editing canvas */}
              <div className="flex-1">
                <div className="text-xs text-cral-muted mb-2">Zone d&apos;édition — cliquez et glissez</div>
                <svg
                  ref={svgRef}
                  viewBox="0 0 100 100"
                  className="w-full aspect-square rounded-xl select-none"
                  style={{ background: '#0a0a0f', border: '1px solid #2a2a40', cursor: 'default' }}
                  onClick={(e) => { if (e.target === svgRef.current) setSelected(null) }}
                >
                  {/* Clip circle to show what the avatar will look like */}
                  <defs>
                    <clipPath id="avatarClip">
                      <circle cx="50" cy="50" r="50" />
                    </clipPath>
                  </defs>

                  {/* Checkerboard background (shows transparent areas) */}
                  <rect width="100" height="100" fill="#1a1a2e" />
                  <rect width="10" height="10" fill="#222233" />
                  <rect x="10" width="10" height="10" y="10" fill="#222233" />

                  {/* Shapes */}
                  <g clipPath="url(#avatarClip)">
                    {layers.map(l => renderShape(l, l.id === selected))}
                  </g>

                  {/* Circle outline */}
                  <circle cx="50" cy="50" r="49.5" fill="none" stroke="#3a3a55" strokeWidth="1" />

                  {/* Selection handles */}
                  {selectedLayer && (() => {
                    const l = selectedLayer
                    return (
                      <g>
                        {/* Dashed selection rect */}
                        <rect
                          x={l.x - 0.5} y={l.y - 0.5}
                          width={l.w + 1} height={l.h + 1}
                          fill="none" stroke="#fbbf24" strokeWidth="0.5"
                          strokeDasharray="2 2" opacity={0.8}
                          style={{ pointerEvents: 'none' }}
                        />
                        {/* Resize handle — bottom right */}
                        <rect
                          x={l.x + l.w - 3} y={l.y + l.h - 3}
                          width={6} height={6}
                          fill="#fbbf24" rx={1}
                          style={{ cursor: 'se-resize' }}
                          onMouseDown={e => startDrag(e, l.id, 'resize')}
                        />
                        {/* Corner handles (display only) */}
                        {[[l.x, l.y], [l.x + l.w, l.y], [l.x, l.y + l.h]].map(([hx, hy], i) => (
                          <circle key={i} cx={hx} cy={hy} r={1.5} fill="#fbbf24" opacity={0.6}
                            style={{ pointerEvents: 'none' }} />
                        ))}
                      </g>
                    )
                  })()}
                </svg>
              </div>

              {/* Live preview as circle */}
              <div className="flex-shrink-0">
                <div className="text-xs text-cral-muted mb-2">Aperçu</div>
                <div className="space-y-3">
                  {[80, 48, 32].map(size => (
                    <div key={size} className="flex flex-col items-center gap-1">
                      <div
                        className="rounded-full overflow-hidden"
                        style={{ width: size, height: size }}
                        dangerouslySetInnerHTML={{ __html: layersToSVG(layers) }}
                      />
                      <span className="text-xs text-cral-muted">{size}px</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Add shapes */}
          <div className="card">
            <div className="text-xs font-medium text-cral-sub mb-3">Ajouter une forme</div>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(SHAPE_ICONS) as ShapeType[]).map(type => (
                <button key={type} onClick={() => addLayer(type)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cral-surface hover:bg-cral-card border border-cral-border hover:border-gold-500/40 transition-all text-sm">
                  <span>{SHAPE_ICONS[type]}</span>
                  <span className="text-cral-sub capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Layers */}
          <div className="card">
            <div className="text-xs font-medium text-cral-sub mb-3">Calques ({layers.length})</div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {[...layers].reverse().map(layer => (
                <div key={layer.id}
                  onClick={() => setSelected(layer.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
                    selected === layer.id ? 'bg-gold-400/15 border border-gold-400/30' : 'hover:bg-cral-surface'
                  }`}>
                  <span>{SHAPE_ICONS[layer.type]}</span>
                  <span className="flex-1 text-cral-text capitalize">{layer.type}</span>
                  <div className="w-4 h-4 rounded-sm flex-shrink-0 border border-white/10"
                    style={{ backgroundColor: layer.fill }} />
                  <button onClick={e => { e.stopPropagation(); moveLayerOrder(layer.id, 'up') }}
                    className="text-cral-muted hover:text-cral-text"><ChevronUp size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); moveLayerOrder(layer.id, 'down') }}
                    className="text-cral-muted hover:text-cral-text"><ChevronDown size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); duplicateLayer(layer.id) }}
                    className="text-blue-400/60 hover:text-blue-400" title="Dupliquer"><Copy size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); deleteLayer(layer.id) }}
                    className="text-red-400/60 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Properties */}
          {selectedLayer && (
            <div className="card space-y-4">
              <div className="text-xs font-medium text-cral-sub">
                Propriétés — <span className="capitalize">{selectedLayer.type}</span>
              </div>

              {/* Size sliders */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-cral-muted mb-1">
                    <span>Largeur</span><span className="font-mono">{Math.round(selectedLayer.w)}</span>
                  </div>
                  <input type="range" min={5} max={100} step={1}
                    value={Math.round(selectedLayer.w)}
                    onChange={e => updateLayer(selectedLayer.id, { w: parseInt(e.target.value) })}
                    className="w-full accent-yellow-400" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-cral-muted mb-1">
                    <span>Hauteur</span><span className="font-mono">{Math.round(selectedLayer.h)}</span>
                  </div>
                  <input type="range" min={5} max={100} step={1}
                    value={Math.round(selectedLayer.h)}
                    onChange={e => updateLayer(selectedLayer.id, { h: parseInt(e.target.value) })}
                    className="w-full accent-yellow-400" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-cral-muted mb-1">
                    <span>Rotation</span><span className="font-mono">{selectedLayer.rotation}°</span>
                  </div>
                  <input type="range" min={0} max={360} step={5}
                    value={selectedLayer.rotation}
                    onChange={e => updateLayer(selectedLayer.id, { rotation: parseInt(e.target.value) })}
                    className="w-full accent-yellow-400" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-cral-muted mb-1">
                    <span>Opacité</span><span className="font-mono">{Math.round(selectedLayer.opacity * 100)}%</span>
                  </div>
                  <input type="range" min={0.1} max={1} step={0.05}
                    value={selectedLayer.opacity}
                    onChange={e => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full accent-yellow-400" />
                </div>
              </div>

              {/* Fill color */}
              <div>
                <div className="text-xs text-cral-muted mb-2">Couleur</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => updateLayer(selectedLayer.id, { fill: c })}
                      className="w-6 h-6 rounded transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        border: selectedLayer.fill === c ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                        outlineOffset: '1px',
                      }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="color" value={selectedLayer.fill}
                    onChange={e => updateLayer(selectedLayer.id, { fill: e.target.value })}
                    className="flex-1 h-8 rounded cursor-pointer border border-cral-border bg-transparent" />
                  <button onClick={activateEyedropper}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs border transition-all ${
                      eyedropperActive ? 'bg-gold-400/20 border-gold-400/50 text-gold-400' : 'border-cral-border text-cral-sub hover:border-cral-muted hover:text-cral-text'
                    }`}
                    title="Pipette — sélectionnez une couleur à l'écran">
                    <Pipette size={12} />
                    Pipette
                  </button>
                </div>
              </div>

              {/* Stroke */}
              <div>
                <div className="text-xs text-cral-muted mb-2">Contour</div>
                <div className="flex items-center gap-3">
                  <input type="color"
                    value={selectedLayer.stroke === 'transparent' ? '#ffffff' : selectedLayer.stroke}
                    onChange={e => updateLayer(selectedLayer.id, { stroke: e.target.value, strokeWidth: Math.max(selectedLayer.strokeWidth, 0.5) })}
                    className="w-10 h-8 rounded cursor-pointer border border-cral-border bg-transparent flex-shrink-0" />
                  <div className="flex-1">
                    <input type="range" min={0} max={4} step={0.5}
                      value={selectedLayer.strokeWidth}
                      onChange={e => {
                        const sw = parseFloat(e.target.value)
                        updateLayer(selectedLayer.id, { strokeWidth: sw, stroke: sw === 0 ? 'transparent' : selectedLayer.stroke })
                      }}
                      className="w-full accent-yellow-400" />
                  </div>
                  <span className="text-xs font-mono text-cral-muted w-6">{selectedLayer.strokeWidth}</span>
                </div>
              </div>
            </div>
          )}

          {!selectedLayer && (
            <div className="card text-center py-8 text-cral-muted text-xs">
              Cliquez sur une forme pour la modifier
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
