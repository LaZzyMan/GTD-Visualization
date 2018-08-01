import L from 'leaflet'

if (!L.DomUtil.setTransform) {
  L.DomUtil.setTransform = function (el, offset, scale) {
    var pos = offset || new L.Point(0, 0)

    el.style[L.DomUtil.TRANSFORM] = (L.Browser.ie3d ? 'translate(' + pos.x + 'px,' + pos.y + 'px)' : 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') + (scale ? ' scale(' + scale + ')' : '')
  }
}

L.CanvasLayer = (L.Layer ? L.Layer : L.Class).extend({
  initialize (options) {
    this._map = null
    this._canvas = null
    this._frame = null
    this._delegate = null
    L.setOptions(this, options)
  },

  delegate (del) {
    this._delegate = del
    return this
  },

  needRedraw () {
    if (!this._frame) {
      this._frame = L.Util.requestAnimFrame(this.drawLayer, this)
    }
    return this
  },

  _onLayerDidResize (resizeEvent) {
    this._canvas.width = resizeEvent.newSize.x
    this._canvas.height = resizeEvent.newSize.y
  },

  _onLayerDidMove () {
    var topLeft = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, topLeft)
    this.drawLayer()
  },

  getEvents () {
    var events = {
      resize: this._onLayerDidResize,
      moveend: this._onLayerDidMove
    }
    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      events.zoomanim = this._animateZoom
    }

    return events
  },

  onAdd (map) {
    this._map = map
    this._canvas = L.DomUtil.create('canvas', 'leaflet-layer')
    this.tiles = {}

    var size = this._map.getSize()
    this._canvas.width = size.x
    this._canvas.height = size.y

    var animated = this._map.options.zoomAnimation && L.Browser.any3d
    L.DomUtil.addClass(this._canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'))

    map._panes.overlayPane.appendChild(this._canvas)
    map.on(this.getEvents(), this)

    var del = this._delegate || this
    del.onLayerDidMount && del.onLayerDidMount()
    this.needRedraw()

    var self = this
    setTimeout(function () {
      self._onLayerDidMove()
    }, 0)
  },

  onRemove (map) {
    var del = this._delegate || this
    del.onLayerWillUnmount && del.onLayerWillUnmount()

    map.getPanes().overlayPane.removeChild(this._canvas)

    map.off(this.getEvents(), this)

    this._canvas = null
  },

  addTo (map) {
    map.addLayer(this)
    return this
  },

  LatLonToMercator (latlon) {
    return {
      x: latlon.lng * 6378137 * Math.PI / 180,
      y: Math.log(Math.tan((90 + latlon.lat) * Math.PI / 360)) * 6378137
    }
  },

  drawLayer () {
    var size = this._map.getSize()
    var bounds = this._map.getBounds()
    var zoom = this._map.getZoom()

    var center = this.LatLonToMercator(this._map.getCenter())
    var corner = this.LatLonToMercator(this._map.containerPointToLatLng(this._map.getSize()))

    var del = this._delegate || this
    del.onDrawLayer && del.onDrawLayer({
      layer: this,
      canvas: this._canvas,
      bounds: bounds,
      size: size,
      zoom: zoom,
      center: center,
      corner: corner
    })
    this._frame = null
  },

  _setTransform (el, offset, scale) {
    var pos = offset || new L.Point(0, 0)
    el.style[L.DomUtil.TRANSFORM] = (L.Browser.ie3d ? 'translate(' + pos.x + 'px,' + pos.y + 'px)' : 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') + (scale ? ' scale(' + scale + ')' : '')
  },

  _animateZoom (e) {
    var scale = this._map.getZoomScale(e.zoom)
    var offset = L.Layer ? this._map._latLngToNewLayerPoint(this._map.getBounds().getNorthWest(), e.zoom, e.center)
      : this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos())

    L.DomUtil.setTransform(this._canvas, offset, scale)
  }
})

L.canvasLayer = () => new L.CanvasLayer()

L.PointAnimateLayer = (L.Layer ? L.Layer : L.Class).extend({
  options: {
    lng: 0.0,
    lat: 0.0,
    color: '',
    ringRadius: 10,
    pointRadius: 5
  },
  _map: null,
  _canvasLayer: null,
  _context: null,
  _timer: 0,
  lifetime: 0,

  initialize (options) {
    // console.log(options)
    L.setOptions(this, options)
    this.lifetime = options.lifetime
  },

  onAdd (map) {
    this._canvasLayer = L.canvasLayer().delegate(this)
    this._canvasLayer.addTo(map)
    this._map = map
  },

  onRemove (map) {
    this._map.removeLayer(this._canvasLayer)
  },

  setData (data) {
    this.options.data = data
  },

  onDrawLayer (viewInfo) {
    const ctx = viewInfo.canvas.getContext('2d')
    ctx.fillStyle = this.options.color
    ctx.strokeStyle = this.options.color
    ctx.clearRect(0, 0, viewInfo.canvas.width, viewInfo.canvas.height)
    const point = {
      coordinates: this._map.latLngToContainerPoint([this.options.lng, this.options.lat]),
      ringRadiusFirst: 0.0,
      ringRadiusSecond: 0.0,
      pointRadius: this.options.pointRadius,
      pointAlpha: 1.0,
      ringAlphaFirst: 1.0,
      ringAlphaSecond: 1.0,
      draw: () => {
        ctx.beginPath()
        ctx.globalAlpha = point.pointAlpha
        ctx.arc(point.coordinates.x, point.coordinates.y, point.pointRadius, 0, Math.PI * 2)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.globalAlpha = point.ringAlphaFirst
        ctx.arc(point.coordinates.x, point.coordinates.y, point.ringRadiusFirst, 0, Math.PI * 2)
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.globalAlpha = point.ringAlphaSecond
        ctx.arc(point.coordinates.x, point.coordinates.y, point.ringRadiusSecond, 0, Math.PI * 2)
        ctx.closePath()
        ctx.stroke()
      }
    }
    window.requestAnimationFrame(draw)
    function draw () {
      ctx.clearRect(0, 0, viewInfo.canvas.width, viewInfo.canvas.height)
      point.draw()
      point.pointAlpha = point.pointAlpha * 0.9
      point.pointRadius = point.pointRadius * 0.9
      point.ringRadiusFirst = point.ringRadiusFirst + 1
      point.ringRadiusSecond = point.ringRadiusSecond + 1
      point.ringAlphaFirst = point.ringAlphaFirst * 0.9
      point.ringAlphaSecond = point.ringAlphaSecond * 0.9
      window.requestAnimationFrame(draw)
    }
  }
})

L.pointAnimateLayer = (options) => new L.PointAnimateLayer(options)

export default L
