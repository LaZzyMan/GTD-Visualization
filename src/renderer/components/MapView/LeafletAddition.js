import L from 'leaflet'
import TWEEN from 'tween.js'

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

function animate () {
  requestAnimationFrame(animate)
  TWEEN.update();
}

L.PointAnimateLayer = (L.Layer ? L.Layer : L.Class).extend({
  options: {
    points: [],
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
    this.drawParams = {
      ringRadiusFirst: 0.0,
      ringRadiusSecond: 0.0,
      pointRadius: 0,
      pointAlpha: 1.0,
      ringAlphaFirst: 1.0,
      ringAlphaSecond: 1.0
    }
    this.animation = new TWEEN.Tween(this.drawParams)
      .to({
        ringRadiusFirst: options.ringRadius / 2,
        ringRadiusSecond: 0.0,
        pointRadius: options.pointRadius / 2,
        pointAlpha: 1.0,
        ringAlphaFirst: 0.5,
        ringAlphaSecond: 1.0
      }, 1000)
      .easing(TWEEN.Easing.Elastic.InOut)
      .onUpdate(this.drawPoints.bind(this))
      .repeat(Infinity)
  },

  onAdd (map) {
    this._canvasLayer = L.canvasLayer().delegate(this)
    this._canvasLayer.addTo(map)
    this._map = map
    this.animation.start()
  },

  onRemove (map) {
    this._map.removeLayer(this._canvasLayer)
    this.animation.stop()
  },

  setData (data) {
    this.options.data = data
  },

  onDrawLayer (viewInfo) {
    this.ctx = viewInfo.canvas.getContext('2d')
    this.canvas = viewInfo.canvas
    this.ctx.fillStyle = this.options.color
    this.ctx.strokeStyle = this.options.color
    animate()
  },

  drawPoints () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const coordinates = this.options.points.map((point) => {
      return this._map.latLngToContainerPoint([point.lat, point.lng])
    })
    coordinates.forEach(coordinate => {
      this.ctx.beginPath()
      this.ctx.globalAlpha = this.drawParamspointAlpha
      this.ctx.arc(coordinate.x, coordinate.y, this.drawParamspointRadius, 0, Math.PI * 2)
      this.ctx.closePath()
      this.ctx.fill()
      this.ctx.beginPath()
      this.ctx.globalAlpha = this.drawParamsringAlphaFirst
      this.ctx.arc(coordinate.x, coordinate.y, this.drawParamsringRadiusFirst, 0, Math.PI * 2)
      this.ctx.closePath()
      this.ctx.stroke()
      this.ctx.beginPath()
      this.ctx.globalAlpha = this.drawParamsringAlphaSecond
      this.ctx.arc(coordinate.x, coordinate.y, this.drawParamsringRadiusSecond, 0, Math.PI * 2)
      this.ctx.closePath()
      this.ctx.stroke()
    })
  }
})

L.pointAnimateLayer = (options) => new L.PointAnimateLayer(options)

export default L
