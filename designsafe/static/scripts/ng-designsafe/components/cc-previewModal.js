import angular from 'angular';
import previewModal from '/static/scripts/ng-designsafe/html/modals/data-browser-service-preview.js';

let mod = angular.module('portal.workbench.components', []);

mod.component('previewModal', previewModal);

export default mod;