export function toTrusted(window, angular, $, _) {
  'ngInject';
  "use strict";
  angular.module('designsafe').filter('toTrusted', function ($sce) {
    return function (value) {
        return $sce.trustAsHtml(value);
    };
  })
}
