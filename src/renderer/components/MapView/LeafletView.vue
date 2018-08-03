<template>
  <div :id="mapId" class="leaft-map-view"></div>
</template>

<script>
import L from './LeafletSVGAddition.js'

const modes = ['space-time', 'static-dynamic']

export default {
  name: 'MapView',
  props: {
    mapId: {
      type: String,
      required: true
    },
    currentDailyData: {
      type: Array,
      default: () => {
        return []
      }
    },
    staticMarkerPosition: {
      type: Object,
      default: () => {
        return {}
      }
    },
    dynamicMarkerPosition: {
      type: Object,
      default: () => {
        return {}
      }
    },
    zoom: {
      type: Number,
      default: 3
    },
    lng: {
      type: Number,
      default: 38
    },
    lat: {
      type: Number,
      default: 38
    },
    mode: {
      type: String,
      default: modes[0]
    },
    mapUrl: {
      type: String,
      default: 'https://api.mapbox.com/styles/v1/hideinme/cjbd5v7f18sxz2rmxt2ewnqtt/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiaGlkZWlubWUiLCJhIjoiY2o4MXB3eWpvNnEzZzJ3cnI4Z3hzZjFzdSJ9.FIWmaUbuuwT2Jl3OcBx1aQ'
    }
  },
  data () {
    return {
      map: null,
      markerLayerGroup: new L.LayerGroup(),
      staticMarkerLayerGroup: new L.LayerGroup(),
      dynamicMarkerLayerGroup: new L.LayerGroup(),
      mapParams: {
        url: this.mapUrl,
        attribution: '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        minZoom: 1,
        maxZoom: 18
      }
    }
  },
  computed: {
    staticMarker () {
      if (this.mode === modes[0]) { return {} }
      var markerOptions = {
        radius: 10,
        stroke: true,
        color: '#E66417',
        weight: 10,
        opacity: 1,
        fill: false,
        render: L.svg(),
        className: 'main-firstring-marker'
      }
      return L.circleMarker([
        this.staticMarkerPosition.lat,
        this.staticMarkerPosition.lng],
      markerOptions)
    }
  },
  components: {},
  mounted () {
    const map = L.map(this.mapId,
      {
        zoomControl: false,
        attributionControl: false
      })
      .setView([this.lng, this.lat], this.zoom)
    L.tileLayer(this.mapParams.url, {
      attribution: this.mapParams.attribution,
      minZoom: this.mapParams.minZoom,
      maxZoom: this.mapParams.maxZoom
    }).addTo(map)
    this.map = map
    this.map.addLayer(this.markerLayerGroup)

    if (this.mode === modes[1]) {
      this.map.addLayer(this.staticMarkerLayerGroup)
      this.map.addLayer(this.dynamicMarkerLayerGroup)
    }
  },
  watch: {
    zoom () {
      this.staticMarkerLayerGroup.clearLayers()
      this.dynamicMarkerLayerGroup.clearLayers()
      this.map.setView([this.lng, this.lat], this.zoom)
      this.$triggerResize()
    },
    currentDailyData () {
      if (this.mode !== modes[0]) { return }
      // add new point layers to layer group
      var that = this
      this.addSinglePoint(that.markerLayerGroup, that.currentDailyData.map((item) => {
        if (!item.geometry.coordinates ||
          !item.geometry.coordinates[0] ||
          !item.geometry.coordinates[1]) { return [] }
        let lng = item.geometry.coordinates[0]
        let lat = item.geometry.coordinates[1]
        return [ lng, lat ]
      }), '#E66417')
      // remove point layers running out life time
      // console.log(this.markerLayerGroup.getLayers().length)
      let deadLayers = []
      this.markerLayerGroup.eachLayer(function (layer) {
        layer.lifetime -= 1
        if (layer.lifetime === 0) {
          deadLayers.push(layer)
        }
      })
      deadLayers.forEach(function (value, index, array) {
        that.markerLayerGroup.removeLayer(value)
      })
    },
    staticMarkerPosition () {
      if (this.mode !== modes[1] ||
      this.staticMarkerPosition === {} ||
      this.staticMarkerPosition.lat === undefined ||
      this.staticMarkerPosition.lng === undefined) { return }
      this.staticMarkerLayerGroup.clearLayers()
      this.addSinglePoint(this.staticMarkerLayerGroup, [{lng: this.staticMarkerPosition.lng, lat: this.staticMarkerPosition.lat}], '#38B2CE')
      this.map.setView([this.staticMarkerPosition.lat, this.staticMarkerPosition.lng], this.zoom)
    },
    dynamicMarkerPosition () {
      if (this.mode !== modes[1] ||
      this.dynamicMarkerPosition === {} ||
      this.dynamicMarkerPosition.lat === undefined ||
      this.dynamicMarkerPosition.lng === undefined) { return }
      this.dynamicMarkerLayerGroup.clearLayers()
      this.addSinglePoint(this.dynamicMarkerLayerGroup, [{lng: this.dynamicMarkerPosition.lng, lat: this.dynamicMarkerPosition.lat}], '#39E639')
    }
  },
  methods: {
    addSinglePoint (layerGroup, points, color) {
      const options = {
        radius: 10
      }
      layerGroup.addLayer(L.SvgPointLayer(points, options, this.map))
    }
  }
}
</script>

<style lang="scss" scoped>
@import url("../../../../node_modules/leaflet/dist/leaflet.css");
.leaft-map-view {
  width: 100%;
  height: 100%;
  background-color: black;
}
</style>
