import LayerGroup from '../models/layer_group';
import MapProject from '../models/map-project';
import DBModalCtrl from './db-modal';
import * as GeoUtils from '../utils/geo-utils';

export default class MapSidebarCtrl {

  constructor ($scope, $window, $timeout, $uibModal, DataService, $http, GeoDataService) {
    'ngInject';
    this.$scope = $scope;
    this.LGeo = $window.LGeo;
    this.$timeout = $timeout;
    this.$window = $window;
    this.$uibModal = $uibModal;
    this.DataService = DataService;
    this.$http = $http;
    this.GeoDataService = GeoDataService;

    this.primary_color = '#ff0000';
    this.secondary_color = '#ff0000';

    //method binding for callback, sigh...
    this.local_file_selected = this.local_file_selected.bind(this);
    this.open_db_modal = this.open_db_modal.bind(this);

    let streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    });

    let satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy;',
      maxZoom: 18,
    });

    let basemaps = {
      'Street': streets,
      'Satellite': satellite
    };

    this.map = L.map('geo_map', {layers: [streets, satellite]}).setView([0, 0], 3);
    this.map_title = 'New Map';
    L.control.layers(basemaps).addTo(this.map);
    this.map.zoomControl.setPosition('bottomleft');

    // trick to fix the tiles that sometimes don't load for some reason...
    $timeout( () => {this.map.invalidateSize();}, 10);

    this.layer_groups = [new LayerGroup('New Group', new L.FeatureGroup())];
    this.map.addLayer(this.layer_groups[0].feature_group);
    this.active_layer_group = this.layer_groups[0];

    // update the current layer to show the details tab
    this.active_layer_group.feature_group.on('click', (e) => {
      this.current_layer ? this.current_layer = null : this.current_layer = e.layer;
      this.$scope.$apply();
    });

    this.add_draw_controls(this.active_layer_group.feature_group);

    this.map.on('draw:created',  (e) => {
      let object = e.layer;
      object.options.color = this.secondary_color;
      object.options.fillColor = this.primary_color;
      object.options.fillOpacity = 0.8;
      this.active_layer_group.feature_group.addLayer(object);
      this.$scope.$apply();
    });

    this.map.on('mousemove', (e) => {
      this.current_mouse_coordinates = e.latlng;
      this.$scope.$apply();
    });


  } // end constructor

  add_draw_controls (fg) {
    let dc = new L.Control.Draw({
      position: 'topright',
      draw: {
        circle: false,
      },
      edit: {
       featureGroup: fg,
       remove: true
      }
    });
    this.map.addControl(dc);
    this.drawControl = dc;
  }


  create_layer_group () {
    let lg = new LayerGroup("New Group", new L.FeatureGroup());
    this.layer_groups.push(lg);
    this.active_layer_group = this.layer_groups[this.layer_groups.length -1];
    this.map.addLayer(lg.feature_group);
    this.select_active_layer_group(this.active_layer_group);
  }

  delete_layer_group (lg, i) {
    this.map.removeLayer(lg.feature_group);
    this.layer_groups.splice(i, 1);
  }

  delete_feature (f) {
    this.map.removeLayer(f);
    this.active_layer_group.feature_group.removeLayer(f);
  }

  show_hide_layer_group (lg) {
    lg.show ? this.map.addLayer(lg.feature_group) : this.map.removeLayer(lg.feature_group);
  }

  select_active_layer_group(lg) {
    this.map.removeControl(this.drawControl);
    this.add_draw_controls(lg.feature_group);
    this.active_layer_group = lg;
    lg.active = true;
    lg.show = true;
  }

  open_db_modal () {
    let modal = this.$uibModal.open({
      templateUrl: "/static/designsafe/apps/geo/html/db-modal.html",
      controller: "DBModalCtrl as vm",
    });
    modal.result.then( (f) => {this.load_from_data_depot(f);});
  }

  open_file_dialog () {
    this.$timeout(() => {
      $('#file_picker').click();
    }, 0);
  }

  get_feature_type (f) {
    if (f instanceof L.Marker) {
      return 'Point';
    } else if (f instanceof L.Polygon) {
      return 'Polygon';
    } else {
      return 'Path';
    }
  }

  zoom_to(feature) {
    if (feature instanceof L.Marker) {
       let latLngs = [ feature.getLatLng() ];
       let markerBounds = L.latLngBounds(latLngs);
       this.map.fitBounds(markerBounds);
    } else {
      this.map.fitBounds(feature.getBounds());
    };
  }

  on_drop (ev, data, lg) {
    let src_lg = this.layer_groups[data.pidx];
    let feature = src_lg.feature_group.getLayers()[data.idx];
    src_lg.feature_group.removeLayer(feature);
    lg.feature_group.addLayer(feature);
  }

  drop_feature_success (ev, data, lg) {
    console.log("drag_feature_success", ev, data, lg)
    // lg.feature_group.getLayers().splicer(idx, 1);
  }

  load_from_data_depot(f) {
    this.loading = true;
    this.GeoDataService.load_from_data_depot(f).then( (lg) => {
      this.layer_groups.push(lg);
      this.map.addLayer(lg.feature_group);
      this.loading = false;
    });
  }

  local_file_selected (ev) {
    let file = ev.target.files[0];
    let lf = this.GeoDataService.load_from_local_file(file).then( (lg) => {
      console.log(lg);
      this.layer_groups.push(lg);
      this.map.addLayer(lg.feature_group);
      let bounds = [];
      this.layer_groups.forEach((lg) =>  {
        bounds.push(lg.feature_group.getBounds());
      });
      this.map.fitBounds(bounds);
    });

  }


  update_layer_style (prop) {
    this.current_layer.setStyle({prop: this.current_layer.options[prop]});
  }


  save_project () {
    let out = {
      "type": "FeatureCollection",
      "features": [],
      "ds_map": true,
      "name": this.map_title
    };
    this.layer_groups.forEach( (lg) => {
      let json = lg.feature_group.toGeoJSON();
      //add in any options
      json.label = lg.label;

      out.features.push(json);
    });
    let blob = new Blob([JSON.stringify(out)], {type: "application/json"});
    let url  = URL.createObjectURL(blob);

    let a = document.createElement('a');
    a.download    = this.map_title + ".json";
    a.href        = url;
    a.textContent = "Download";
    a.click();
  }

}
