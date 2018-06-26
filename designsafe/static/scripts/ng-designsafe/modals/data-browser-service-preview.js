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
        //////////////////////////
        constructor(file, listing){
        $scope.file = file;
        if (typeof listing !== 'undefined' &&
          typeof listing.metadata !== 'undefined' &&
          !_.isEmpty(listing.metadata.project)) {
          var _listing = angular.copy(listing);
          $scope.file.metadata = _listing.metadata;
        }
        $scope.busy = true;
      }
        file.preview().then(
          (data)=>{
            $scope.previewHref = $sce.trustAs('resourceUrl', data.href);
            $scope.busy = false;
          }, (err)=>{
            var fileExt = file.name.split('.').pop();
            var videoExt = ['webm', 'ogg', 'mp4'];

            //check if preview is video
            if (videoExt.includes(fileExt)) {
              $scope.prevVideo = true;
              file.download().then(
                (data)=>{
                  var postit = data.href;
                  var oReq = new XMLHttpRequest();
                  oReq.open("GET", postit, true);
                  oReq.responseType = 'blob';

                  oReq.onload = ()=>{
                    if (this.status === 200) {
                      var videoBlob = this.response;
                      var vid = URL.createObjectURL(videoBlob);

                      // set video source and mimetype
                      document.getElementById("videoPlayer").src = vid;
                      document.getElementById("videoPlayer").setAttribute('type', `video/${fileExt}`);
                    };
                  };
                  oReq.onerror = ()=>{
                    $scope.previewError = err.data;
                    $scope.busy = false;
                  };
                  oReq.send();
                  $scope.busy = false;
                },
                (err)=>{
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
                (data)=>{
                  var postit = data.href;
                  var oReq = new XMLHttpRequest();

                  oReq.open("GET", postit, true);

                  oReq.onload = (oEvent)=>{
                    var blob = new Blob([oReq.response], { type: "application/json" });
                    var reader = new FileReader();

                    reader.onload = (e)=>{
                      var content = JSON.parse(e.target.result);
                      var target = $('.nbv-preview')[0];
                      nbv.render(content, target);
                    };

                    reader.readAsText(blob);
                  };

                  oReq.send();
                },
                (err)=>{
                  $scope.previewError = err.data;
                  $scope.busy = false;
                });
            }
          }
        );

        $scope.tests = allowedActions([file]);

        $scope.download = ()=>{
          download(file);
        };
        $scope.share = ()=>{
          share(file);
        };
        $scope.copy = ()=>{
          copy(file);
        };
        $scope.move = ()=>{
          move(file, currentState.listing);
        };
        $scope.rename = ()=>{
          rename(file);
        };
        $scope.viewMetadata = ()=>{
          $scope.close();
          viewMetadata([file]);
        };
        $scope.trash = ()=>{
          trash(file);
        };
        $scope.rm = ()=>{
          rm(file);
        };

        $scope.close = ()=>{
          $uibModalInstance.dismiss();
        };

      }],
      size: 'lg',
      resolve: {
        file: ()=>{ return file; }
      }
    });
    return modal.result;
  }
}