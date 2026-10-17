import { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import './App.css'

type CacheStatus = 'HIT' | 'MISS' | 'Unavailable'

type PlayerMetrics = {
  playback: string
  cache: CacheStatus
  cacheHits: number
  cacheMisses: number
  speedMbps: number | null
  bufferSeconds: number
  currentTime: number
  duration: number
}

type VhsRequest = {
  uri?: string
  url?: string
  bandwidth?: number
  bytesReceived?: number
  roundTripTime?: number
}

type VhsRequestOptions = {
  uri?: string
  url?: string
}

type VhsResponse = {
  headers?: Record<string, string>
  url?: string
  body?: ArrayBuffer | string
}

type VhsRequestHook = (options: VhsRequestOptions) => VhsRequestOptions

type VhsResponseHook = (
  request: VhsRequest,
  error: unknown,
  response?: VhsResponse,
) => void

type VhsXhr = {
  onRequest: (callback: VhsRequestHook) => void
  offRequest: (callback: VhsRequestHook) => void
  onResponse: (callback: VhsResponseHook) => void
  offResponse: (callback: VhsResponseHook) => void
}

type VideoJsWithVhs = typeof videojs & {
  Vhs?: {
    xhr?: VhsXhr
  }
}

const playlistUrl = '/video/movie001-video/output.m3u8'
const posterUrl = '/video/movie001-video/poster.jpg'

function getRequestPath(url: string | undefined) {
  return url ? new URL(url, window.location.href).pathname : ''
}

const initialMetrics: PlayerMetrics = {
  playback: 'Ready to play',
  cache: 'Unavailable',
  cacheHits: 0,
  cacheMisses: 0,
  speedMbps: null,
  bufferSeconds: 0,
  currentTime: 0,
  duration: 0,
}

function VideoPlayer() {
  const videoContainerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [error, setError] = useState('')

  useEffect(() => {
    const container = videoContainerRef.current
    if (!container) return

    const element = document.createElement('video')
    element.className = 'video-js vjs-big-play-centered'
    element.setAttribute('playsinline', '')
    element.setAttribute('aria-label', 'Movie 001 HLS video')
    container.appendChild(element)

    const player = videojs(element, {
      autoplay: false,
      controls: true,
      fluid: false,
      muted: false,
      preload: 'auto',
      poster: posterUrl,
      responsive: true,
      sources: [{ src: playlistUrl, type: 'application/x-mpegURL' }],
    })
    playerRef.current = player

    const updatePlaybackMetrics = () => {
      const buffered = player.buffered()
      const currentTime = player.currentTime() || 0
      const bufferedEnd = buffered.length > 0 ? buffered.end(buffered.length - 1) : currentTime

      setMetrics((current) => ({
        ...current,
        bufferSeconds: Math.max(0, bufferedEnd - currentTime),
        currentTime,
        duration: player.duration() || 0,
      }))
    }

    const setPlayback = (playback: string) => {
      setMetrics((current) => ({ ...current, playback }))
    }

    const vhsXhr = (videojs as VideoJsWithVhs).Vhs?.xhr
    const requestStartedAt = new Map<string, number>()
    const onRequest: VhsRequestHook = (options) => {
      const path = getRequestPath(options.uri ?? options.url)
      if (/\.ts$/i.test(path)) requestStartedAt.set(path, performance.now())
      return options
    }
    const onResponse: VhsResponseHook = (request, requestError, response) => {
      const path = getRequestPath(request.uri ?? request.url ?? response?.url)
      if (!/\.ts$/i.test(path)) return

      const startedAt = requestStartedAt.get(path)
      requestStartedAt.delete(path)

      const cacheHeader = response?.headers?.['x-cache']?.toUpperCase()
      const cache: CacheStatus = cacheHeader === 'HIT' || cacheHeader === 'MISS'
        ? cacheHeader
        : 'Unavailable'

      const elapsedMs = request.roundTripTime
        ?? (startedAt === undefined ? undefined : performance.now() - startedAt)
      const receivedBytes = request.bytesReceived
        ?? (response?.body instanceof ArrayBuffer ? response.body.byteLength : undefined)
      const speedBps = request.bandwidth
        ?? (
          receivedBytes !== undefined && elapsedMs && elapsedMs > 0
            ? (receivedBytes * 8 * 1000) / elapsedMs
            : null
        )

      setMetrics((current) => ({
        ...current,
        cache,
        cacheHits: current.cacheHits + (cache === 'HIT' ? 1 : 0),
        cacheMisses: current.cacheMisses + (cache === 'MISS' ? 1 : 0),
        speedMbps: !requestError && speedBps !== null && Number.isFinite(speedBps)
          ? speedBps / 1_000_000
          : current.speedMbps,
      }))
    }
    vhsXhr?.onRequest(onRequest)
    vhsXhr?.onResponse(onResponse)

    player.on('loadedmetadata', updatePlaybackMetrics)
    player.on('timeupdate', updatePlaybackMetrics)
    player.on('progress', updatePlaybackMetrics)
    player.on('playing', () => {
      setPlayback('Playing')
      setError('')
    })
    player.on('waiting', () => setPlayback('Buffering'))
    player.on('pause', () => setPlayback('Paused'))
    player.on('ended', () => setPlayback('Finished'))
    player.on('error', () => {
      const playerError = player.error()
      setPlayback('Playback error')
      setError(playerError?.message ?? 'The video could not be loaded.')
    })
    return () => {
      vhsXhr?.offRequest(onRequest)
      vhsXhr?.offResponse(onResponse)
      player.dispose()
      playerRef.current = null
    }
  }, [])

  const startPlayback = () => {
    const playback = playerRef.current?.play()
    playback?.catch((playError: unknown) => {
      setMetrics((current) => ({ ...current, playback: 'Playback blocked' }))
      setError(playError instanceof Error ? playError.message : 'Press play to start the video.')
    })
  }

  const cacheClass = metrics.cache.toLowerCase()

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Streamlab home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>STREAMLAB</span>
        </a>
        <span className="environment"><span className="status-dot" /> LOCAL PLAYBACK</span>
      </header>

      <section className="player-section" aria-labelledby="page-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HLS TEST PLAYER</p>
            <h1 id="page-title">Movie 001</h1>
            <p className="subtitle">H.264 720p video with AAC stereo audio</p>
          </div>
          <span className="format-badge">HLS <span>/</span> H.264 + AAC</span>
        </div>

        <div className="player-frame">
          <div className="player-label"><span className="live-dot" /> NOW PLAYING</div>
          <div className="video-wrap">
            <div ref={videoContainerRef} className="video-container" />
            {metrics.playback !== 'Playing' && (
              <button className="play-overlay" type="button" onClick={startPlayback}>
                <span className="play-overlay-icon" aria-hidden="true" />
                <span>{metrics.playback === 'Buffering' ? 'BUFFERING' : 'PLAY VIDEO'}</span>
              </button>
            )}
          </div>
        </div>
        {error && <p className="player-error" role="alert">{error}</p>}
      </section>

      <footer className="telemetry" aria-label="Streaming diagnostics">
        <div className="telemetry-heading">
          <div>
            <p className="eyebrow">LIVE DIAGNOSTICS</p>
            <h2>Stream health</h2>
          </div>
          <span className="telemetry-caption">Updates while the video plays</span>
        </div>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-label">LATEST CACHE</span>
            <span className={`metric-value cache-value ${cacheClass}`}>
              <span className="cache-indicator" />
              {metrics.cache}
            </span>
            <span className="metric-note">{metrics.cacheHits} hits · {metrics.cacheMisses} misses</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">DOWNLOAD SPEED</span>
            <span className="metric-value">
              {metrics.speedMbps === null ? '—' : `${metrics.speedMbps.toFixed(1)} Mbps`}
            </span>
            <span className="metric-note">Most recent segment</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">BUFFER AHEAD</span>
            <span className="metric-value">{metrics.bufferSeconds.toFixed(1)} <small>sec</small></span>
            <span className="metric-note">Video ready to play</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">PLAYBACK</span>
            <span className="metric-value playback-value">{metrics.playback}</span>
            <span className="metric-note">movie001-video / output.m3u8</span>
          </div>
        </div>
        <div className="footer-note">
          <span>STREAMING THROUGH NGINX + VARNISH</span>
          <span>Cache status is read from the segment response</span>
        </div>
      </footer>
    </main>
  )
}

export default VideoPlayer
