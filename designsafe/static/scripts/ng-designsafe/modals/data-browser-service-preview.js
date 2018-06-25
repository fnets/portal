import template from '/static/scripts/ng-designsafe/html/modals/data-browser-service-preview.html';

class Preview{
  /**
   *
   * @param {FileListing} file
   * @return {Promise}
   */
  constructor preview(file, listing) {
    var modal = $uibModal.open({
      controller: ['$scope', '$uibModalInstance', '$sce', 'file', function ($scope, $uibModalInstance, $sce, file) {
        $scope.file = file;
        if (typeof listing !== 'undefined' &&
          typeof listing.metadata !== 'undefined' &&
          !_.isEmpty(listing.metadata.project)) {
          var _listing = angular.copy(listing);
          $scope.file.metadata = _listing.metadata;
        }
        $scope.busy = true;

        file.preview().then(
          function (data) {
            $scope.previewHref = $sce.trustAs('resourceUrl', data.href);
            $scope.busy = false;
          },
          function (err) {
            var fileExt = file.name.split('.').pop();
            var videoExt = ['webm', 'ogg', 'mp4'];

            //check if preview is video
            if (videoExt.includes(fileExt)) {
              $scope.prevVideo = true;
              file.download().then(
                function (data) {
                  var postit = data.href;
                  var oReq = new XMLHttpRequest();
                  oReq.open("GET", postit, true);
                  oReq.responseType = 'blob';

                  oReq.onload = function () {
                    if (this.status === 200) {
                      var videoBlob = this.response;
                      var vid = URL.createObjectURL(videoBlob);

                      // set video source and mimetype
                      document.getElementById("videoPlayer").src = vid;
                      document.getElementById("videoPlayer").setAttribute('type', `video/${fileExt}`);
                    };
                  };
                  oReq.onerror = function () {
                    $scope.previewError = err.data;
                    $scope.busy = false;
                  };
                  oReq.send();
                  $scope.busy = false;
                },
                function (err) {
                  $scope.previewError = err.data;
                  $scope.busy = false;
                });
              // if filetype is not video or ipynb
            } else if (fileExt != 'ipynb') {
              $scope.previewError = err.data;
              $scope.busy = false;
              // if filetype is ipynb
            } else {
              file.download().then(
                function (data) {
                  var postit = data.href;
                  var oReq = new XMLHttpRequest();

                  oReq.open("GET", postit, true);

                  oReq.onload = function (oEvent) {
                    var blob = new Blob([oReq.response], { type: "application/json" });
                    var reader = new FileReader();

                    reader.onload = function (e) {
                      var content = JSON.parse(e.target.result);
                      var target = $('.nbv-preview')[0];
                      nbv.render(content, target);
                    };

                    reader.readAsText(blob);
                  };

                  oReq.send();
                },
                function (err) {
                  $scope.previewError = err.data;
                  $scope.busy = false;
                });
            }
          }
        );

        $scope.tests = allowedActions([file]);

        $scope.download = function () {
          download(file);
        };
        $scope.share = function () {
          share(file);
        };
        $scope.copy = function () {
          copy(file);
        };
        $scope.move = function () {
          move(file, currentState.listing);
        };
        $scope.rename = function () {
          rename(file);
        };
        $scope.viewMetadata = function () {
          $scope.close();
          viewMetadata([file]);
        };
        $scope.trash = function () {
          trash(file);
        };
        $scope.rm = function () {
          rm(file);
        };

        $scope.close = function () {
          $uibModalInstance.dismiss();
        };

      }],
      size: 'lg',
      resolve: {
        file: function () { return file; }
      }
    });

    // modal.rendered.then(
    //   function(){
    //     if (file.name.split('.').pop() == 'ipynb'){
    //       file.download().then(
    //         function(data){
    //           var postit = data.href;
    //           var oReq = new XMLHttpRequest();

    //           oReq.open("GET", postit, true);

    //           oReq.onload = function(oEvent) {
    //             var blob = new Blob([oReq.response], {type: "application/json"});
    //             var reader = new FileReader();

    //             reader.onload = function(e){
    //               var content = JSON.parse(e.target.result)
    //               var target = $('.nbv-preview')[0];
    //               nbv.render(content, target);
    //             }

    //             reader.readAsText(blob)
    //           };

    //           oReq.send();
    //         },
    //         function (err) {
    //           $scope.previewError = err.data;
    //           $scope.busy = false;
    //         }
    //       );
    // }})

    return modal.result;
  }
}