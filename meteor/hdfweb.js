//Explanatory notes
//The folder is the top level of organization. It currently contains only files, but eventually it will be able to contain
//other folders. 
//Images is a object collection containing HDF5 images. 
//collections related config
Images = new Meteor.Collection('images');
Folders = new Meteor.Collection('folders');
Annotations = new Meteor.Collection('annotations');
Admins = new Meteor.Collection('admins'); //all administrator user IDs go in here


//User permission levels?

/*Annotations.allow({
  insert: function (userId, doc) {
    return (userId && annotation.creator === userId);
  },
  update: function (userId, doc, fields, modifier) {
    return doc.creator === userId;
  },
  remove: function (userId, doc) {
    return doc.creator === userId;
  },
  fetch: ['creator']
});

Annotations.deny({
  update: function (userId, docs, fields, modifier) {
    return _.contains(fields, 'creator');
  }
});)*/

//security rules
//Write security rules in here, I think only server side changes are good
//accounts related stuff
Accounts.config({
  sendVerificationEmail: true,
  forbidClientAccountCreation: false
});

if (Meteor.isClient) {
  //handlebars helper functions
  Handlebars.registerHelper('isAdmin', function() { //DO NOT RELY ON THIS FOR SECURITY, USE ALLOW
    return Meteor.call('isAdmin');
  });

  //a smarter each to retrieve children
  Handlebars.registerHelper('each_children', function(context, options) {
    var ret = "";
    Template.folders.children(context).forEach(function(child) {
      ret = ret + options.fn(child);
    });
    return ret;

  });

  Handlebars.registerHelper('labelBranch', function(label, options) {
    var data = this;
    return Spark.labelBranch(label, function() {
      return options.fn(data);
    });
  });


  //Session variable guide:
  // currentCollectionId
  Session.setDefault("currentFolderId", null);
  Session.setDefault("currentView", "viewingFirstScreen");
  Session.setDefault("currentImageId", null);
  Session.setDefault("currentImageView", "viewingNothing");
  Session.setDefault("currentWebGLMode", "image");
  Session.setDefault("currentFrameIndex", 0); //frameindex
  Session.setDefault("currentFrameURL", null);
  Session.setDefault("startFrameIndex", 0);
  Session.setDefault("endFrameIndex", 0);
  Session.setDefault("currentSearchTerm", "");
  Session.setDefault("searchJSON", "{}"); 
  //Folder related functions
  Template.folders.foldersTop = function() {

    return Folders.find({
      parent: null
    });
  }

  Template.folders_main.children = function(parentId) {
    //call stack error lies here
    return Folders.find({
      parent: parentId
    });
  }

  Template.folders_main.hasChildren = function(parentId) {
    var numFolders = Folders.find({
      parent: parentId
    }).count();
    if (numFolders > 0) {
      return true;
    } else {
      return false;
    }
  }

  Template.folders.isCurrentFolder = function(folder) {
    return Session.get("currentFolderId") === folder;
  }

  Template.folders_main.isCurrentFolder = function(folder) {
    return Template.folders.isCurrentFolder(folder);
  }

  Template.folders.events = {
    'click .folderLi': function(e) {
      e.preventDefault();
      Session.set("currentFolderId", $(e.target).attr("id"));
      Session.set("currentView", "fileListing");
    },
    'dragover .folderLi': function(e, t) {
      e.preventDefault();
      $(e.target).addClass('dragover');

    },
    'dragover #topLevelFolder': function(e, t) {
      e.preventDefault();
      $(e.target).addClass('dragover');
    },
    'dragleave #topLevelFolder': function(e, t) {
      e.preventDefault();
      $(e.target).removeClass('dragover');
    },
    'dragleave .folderLi': function(e, t) {
      e.preventDefault();
      $(e.target).removeClass('dragover');
    },
    'drop .folderLi': function(e, t) {
      e.preventDefault();
      console.log(e.dataTransfer.getData('folderId'));
      e.dataTransfer.dropeffect = 'move';
      if (e.dataTransfer.getData('folderId') == "") {
        Meteor.call('moveFileToFolder', $.trim(e.dataTransfer.getData('text')), $(e.target).attr('id'), function(err, result) {
          if (err) {
            alert("There was an error");
          } else if (result !== "Success") {
            alert(result);
          }
          $(e.target).removeClass('dragover');
        });
      } else if (e.dataTransfer.getData('folderId') !== "") {
        Meteor.call('moveFolderToFolder', $.trim(e.dataTransfer.getData('folderId')), $(e.target).attr('id'), function(err, result) {
          if (err) {
            alert("There wasn an error");
          } else if (result !== "Success") {
            alert(result);
          }
          $(e.target).removeClass('dragover');
        });
      }
      //edit this to make the differentiation between folders and images
    },
    'dragstart li.folderLi': function(e, t) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('folderId', $.trim($(e.target).children().clone().remove().end().attr('id')));
    },
    'drop #topLevelFolder': function(e, t) {
      e.preventDefault();
      e.dataTransfer.dropeffect = 'move';
      if (e.dataTransfer.getData('folderId') == "") {
        alert("All files must be in a folder.");
      } else if (e.dataTransfer.getData('folderId') !== "") {
        Meteor.call('moveFolderToFolder', $.trim(e.dataTransfer.getData('folderId')), null, function(err, result) {
          if (err) {
            alert("There was an error.");
          } else if (result !== "Success") {
            alert(result);
          }
          $(e.target).removeClass('dragover');
        });
      }

    },
    'click #addFolder': function(e) {
      e.preventDefault();
      var folderName = prompt("Enter folder name: ");
      //add validation here
      if (folderName == null) {
        return;
      }
      Meteor.call('makeFolder', folderName, function(err, result) {
        if (err) {
          alert("There was an error.");
        } else if (result !== "Success") {
          alert(result);
        }
      });
    }
  }

  //FileView related objects
  Template.fileView.filesWithId = function() {
    return Images.find({
      folderId: Session.get("currentFolderId")
    });
  }

  Template.fileView.removeFolder = function() {
    if (confirm("Do you really want to delete this folder? Deleting a folder strands all of the files within it.")) {
      Meteor.call('deleteFolder', Session.get("currentFolderId"), function(err, result) {
        if (err) {
          alert(err);
        } else if (result !== "Success") {
          alert(result);
        } else {
          Session.set("currentView", "viewingFirstScreen");
        }
      });

    }
  }
  Template.fileView.getFolderName = function() {
    var folder = Folders.findOne({
      _id: Session.get("currentFolderId")
    });
    if (typeof(folder) !== "undefined") {
      return folder.name;
    } else {
      return "";
    }
  }

  Template.fileView.events = {
    'mouseenter .fileViewRow': function(e) {
      $(e.target).children().addClass("fileViewRowActive");
    },
    'mouseleave .fileViewRow': function(e) {
      $(e.target).children().removeClass("fileViewRowActive");
    },
    'click .fileViewRow': function(e) {
      //var idArray = $(e.target).parent().attr("fileid").match(/"(.*?)"/);
      //var idArrayString = idArray[1]
      Session.set("currentImageId", $(e.target).parent().attr("fileid"));
      Session.set("currentImageView", "viewingImage");
    },
    'dragstart .fileViewRow': function(e) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text', e.target.cells[0].innerHTML); // id
    },
    'click #removeFolder': function(e) {
      e.preventDefault();
      Template.fileView.removeFolder();
    }
  }

  Template.header.connectionStatus = function() {
    return Meteor.status().status;
  }

  Template.header.searchtest = function(searchterm) {
    Meteor.call('search', searchterm, "autocomplete", function(err, result) {
      console.log(result);
      if (err) {
        console.log(err);
      }
    });
  }

  Template.header.rendered = function() {
    $('#annotationSearch').typeahead({
      items: 10,
      minLength: 2,
      updater: function(item) {
        Session.set("currentView", "searchResults");
        Session.set("currentSearchTerm", item);
        $("body").animate({
          scrollTop: 0
        }, "slow");
      },
      source: function(query, process) {
        Meteor.call('search', ".*" + query.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1") + ".*", "autocomplete", function(err, result) {
          if (result && result.length) {
            result.unshift(query.trim());
          } else if (result.length == 0) {
            result = ["No results were found for " + query];
          }
          //cut down on length here, just maybe one or two words around the phrase in question
          process(result);
        });
      }
    });
  }

  Template.searchResults.currentSearchTerm = function() {
    return Session.get("currentSearchTerm");
  }

  Template.searchResults.searchResultsIntermediate = function () {
    var query = Session.get("currentSearchTerm");
    Meteor.call("search", ".*" + query.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1") + ".*", "full", function(err, result) {
      if (result.length == 0) {
            result = [];
          }
          var json_result = JSON.stringify(result);
          Session.set("searchJSON", json_result);
    });
  }

  Template.searchResults.searchResults = function () {
    Template.searchResults.searchResultsIntermediate();
    var searchObject = JSON.parse(Session.get("searchJSON"));
    if (typeof(searchObject) == "undefined") {
      return;
    }
    var returnObject = [];
    for(var i=0; i < searchObject.length; i++) {
      var id = searchObject[i]._id;
      var userName = Meteor.users.findOne(searchObject[i].userId).emails[0].address;
      var comment = searchObject[i].comment;
      var imageName = Images.findOne(searchObject[i].imageId).baseName;
      if (typeof(imageName) == "undefined") {
        imageName = "undefined";
      }
      var startFrame = searchObject[i].startFrame;
      var endFrame = searchObject[i].endFrame;
      returnObject.push({_id: id, user: userName, comment: comment, imageName: imageName, startFrame: startFrame, endFrame: endFrame});
    }
    console.log(returnObject);
    return returnObject;
  }

  Template.searchResults.events = {
    'click .fileViewRow': function(e) {
      var image = Images.findOne(Annotations.findOne($(e.target).parent().attr("annotationId")).imageId)._id;
      console.log(image);
      Session.set("currentImageId", image);
      Session.set("currentImageView", "viewingImage");
      $("body").animate({ scrollTop: $(document).height() }, 1000); //perhaps make this more sophisticated with a callback later
    }
  }


  Template.mainView.isViewing = function(view) {
    return Session.get("currentView") === view;
  }
  //UI related stuff
  //Header stuff
  Template.header.events = {
    'click #triggerAbout': function() {
      Session.set("currentView", "viewingAbout");
    },
    'click #triggerHelp': function() {
      Session.set("currentView", "viewingHelp");
    },
    'click #triggerFirstScreen': function() {
      Session.set("currentView", "viewingFirstScreen");
    }
  }

  //image information stuff
  Template.imageInformation.imageObject = function() {
    return Images.findOne(Session.get("currentImageId"));
  };

  Template.imageView.isViewing = function(view) {
    return Session.get("currentImageView") === view;
    //insert first time rendering function here
    //var imagePath = Images.findOne(Session.get("currentImageId")).imagePath;
    //loadimage(imagePath);
  }

  //annotations related stuff
  Template.imageAnnotations.annotationsForImage = function() {
    console.log('Found annotations for images');
    return Annotations.find({
      imageId: Session.get("currentImageId")
    });
  }

  Template.imageAnnotations.rendered = function() {
    $('[rel=tooltip]').tooltip();
  }

  Template.imageAnnotations.noAnnotations = function() {
    if (Annotations.find({
      imageId: Session.get("currentImageId")
    }).count() == 0) {
      return true;
    }
    return false;
  }
  Template.imageAnnotations.startFrame = function() {
    return Session.get("startFrameIndex");
  }

  Template.imageAnnotations.creator = function(userId) {
    return Meteor.users.findOne(userId).emails[0].address;
  }

  Template.imageAnnotations.endFrame = function() {
    return Session.get("endFrameIndex");
  }

  Template.imageAnnotations.events = {
    'click #submitAnnotation': function(e) {
      e.preventDefault();
      var startFrame = Session.get('startFrameIndex');
      var endFrame = Session.get('endFrameIndex');
      var comment = $('textarea#commentInput').val();
      Meteor.call('createAnnotation', startFrame, endFrame, comment, Session.get("currentImageId"), function(err, result) {
        if (err) {
          alert(err);
        } else if (result != "Success") {
          alert(result);
        } else {
          $('.commmentInput').val('');
        }
      });
    },
    'click #endButton': function(e) {
      //get input from slider here
      //merge these two events into one, getting target to set proper value
    },
    'click #startButton': function(e) {
      //get input from slider here
    },
    'click .icon-remove-sign': function(e) {
      Meteor.call('removeAnnotation', $(e.target).attr('id'), function(err, result) {
        if (err) {
          alert(err);
        } else if (result != "Success") {
          alert(result);
        }
      });
    }
  }

  //webgl related stuff
  Template.webgl.renderImage = function() {
    var imageObject = Images.findOne(Session.get("currentImageId"));
    //var imagePath = imageObject.path;
    //rewrite so path is a session variable handled by the UI instead of here
    imagePath = "/images/lensgrid.png";

    loadimage(imagePath);
    if (Session.get("currentWebGLMode") === "image") {
      newmode("lightfield");
      newmode("image");
    } else {
      newmode("lightfield");
    }

  }

  Template.webgl.needsGridBox = function() {
    if (Session.get("currentWebGLMode") === "image") {
      return true;
    } else {
      return false;
    }
  }
  Template.webgl.rendered = function() {
    //load image with ID stored in current session variable
    Template.webgl.renderImage();
    updateUV_display();

    //set up jquery UI slider here
    $("#imageSlider").slider({
      value: 0,
      orientation: "horizontal",
      range: "min",
      animate: true,
      change: function() {
        //insert code to change Session variable with image URL and call loadImage
        //change loadimage to get autorectification parameters from database
      }
    });
    // setup interface
    $("#grid").button();
    $('.btn-group').button();
    $("#gainSlider").slider({
      value: 0,
      min: -1,
      max: 1,
      step: 0.05,
      orientation: "horizontal",
      range: "min",
      animate: true,
      change: function() {
        $('#gain_current').html(Math.pow(10, $("#gainSlider").slider("value")).toFixed(2));
        render_if_ready(image, 0);
      }
    });


    $("#gammaSlider").slider({
      value: 1,
      min: 0.5,
      max: 1.5,
      step: 0.01,
      orientation: "horizontal",
      range: "min",
      animate: true,
      change: function() {
        $('#gamma_current').html(parseFloat($("#gammaSlider").slider("value")).toFixed(2));
        render_if_ready(image, 0);
      }
    });


    //$("#gainSlider").slider("value");
  }
  //WebGL related stuff
  Template.webgl.events = {
    'change #imageselect': function(e) {
      console.log("Image changed");
      loadimage($(e.target).val());
      //change this with session variable
    },

    'change #rendermode': function(e) {
      console.log("Mode changed");

      newmode($(e.target).val());
      Session.set("currentWebGLMode", $('#rendermode').val());
      render(image, 1);
    },
    'mousedown #canvas-lightfield': function(e) {
      console.log("mousedown" + e.pageX);
      mousedrag_X = e.pageX;
      mousedrag_Y = e.pageY;
      $(window).mousemove(function() {
        console.log("mousedrag" + e);
        mousedrag(e.pageX, e.pageY);
      });
      $(window).mouseup(function() {
        console.log("mouseup");
        $(window).unbind("mousemove");
        $(window).unbind("mouseup");
      });
    },
    //NOTE, GAMMA AND GAIN WERE CHANGED IN STATIC.JS
/*'change #gain' : function (e) {
      console.log("Gain changed");
      $('#gain_current').html(Math.pow(10, $(e.target).val()).toFixed(2));
      render_if_ready(image,0);
    }, */
/*'mouseleave #gainSlider' : function (e) {
      console.log("Gain changed");
      $('#gain_current').html(Math.pow(10, $("#gainSlider").slider("value")).toFixed(2));
      render_if_ready(image,0);
    },*/
    //Slider callback is set above
    //this might cause some problems, not having the .change(), also check spelling
    'click #grid': function() {
      $("#grid").toggleClass('active');
      render_if_ready(image, 0);
    }
  }






}


if (Meteor.isServer) {

  Meteor.startup(function() {

    //FileCollections.insert({name:"Light-field Microscopy"});
    //FileCollections.insert({name:"Light-sheet Microscopy"});
    //Images.insert({baseName : "Test1", Size :"20050", collectionId:"test"});
  });
  //add some dummy data
  Meteor.methods({
    isAdmin: function() {
      var user = Meteor.user();
      if (!("string" === typeof(user.admin) && "admin" == (user.admin))) {
        return false;
      }
      return true;
    },
    search: function(searchterm, mode) {
      //this is the shadiest hack ever, even mongo documentation warns against using this in production
      //meh, i'll look for security holes later
      //thanks Thimo Brinkmann! https://groups.google.com/forum/#!topic/meteor-talk/x9kYnO52Btg
      //follow these steps in mongo console to enable:
      //> use admin
      //> db.runCommand({setParameter:1, textSearchEnabled: true})
      //> use meteor
      // example for annotations
      //> db.annotations.ensureIndex({comment:"text"})
      // sample search
      //> db.annotations.runCommand("text",{search:"test"})
      console.log("Ran search");
      var searchterm_mod = '';

      var searchterms = searchterm.trim().split(" ");
      for (var i = 0; i < searchterms.length; i++) {
        searchterm_mod += '\"' + searchterms[i] + '\"' + ' ';
      }

      searchterm_mod = searchterm_mod.replace(/\.\*|\(|\)/g, "").trim();

      Future = Npm.require('fibers/future');

      var fut = new Future();

      Meteor._RemoteCollectionDriver.mongo.db.executeDbCommand({
        "text": "annotations",
        search: searchterm,
        limit: 10
      }, function(error, results) {
        if (results && results.documents[0].ok === 1) {
          var ret = results.documents[0].results;
          if (mode == "autocomplete") {
            fut.ret(_.uniq(_.map(_.pluck(ret, 'obj'), function(text) {
              return text.comment;
            })));
          } else {
            fut.ret(_.uniq(_.map(_.pluck(ret, 'obj'), function(text) {
              return text;
            })));

          }
        }
      });
      return fut.wait();
    },
    createAnnotation: function(startFrame, endFrame, comment, image) {
      var user = Meteor.user();
      if (startFrame <= endFrame) {
        //maybe run some comment validation here
        if (comment == "") {
          return "The input cannot be blank";
        } else {
          Annotations.insert({
            startFrame: startFrame,
            endFrame: endFrame,
            comment: comment,
            userId: user._id,
            imageId: image
          });
          return "Success";
        }
      } else {
        return "The start frame must be less than or equal to the end frame";
      }
    },
    removeAnnotation: function(annotationId) {
      if (Meteor.call('isAdmin')) {
        Annotations.remove(annotationId);
        return "Success";
      }
    },
    makeFolder: function(folderName) {
      if (Meteor.call('isAdmin')) {
        Folders.insert({
          name: folderName
        });
        return "Success";
      } else {
        return "You must be an administrator to create folders.";
      }
    },
    deleteFolder: function(folderId) {
      //TODO: move all files in the folder to the top level
      if (Meteor.call('isAdmin')) {
        Folders.remove(folderId);
        return "Success";
      }
      return "There was an error removing the folder";
    },
    moveFileToFolder: function(file, folder) {
      if (Meteor.call('isAdmin')) {
        Images.update(file, {
          $set: {
            folderId: folder
          }
        });
        return "Success";
      } else {
        return "You must be an administrator to move files.";
      }
    },
    moveFolderToFolder: function(movingFolder, destinationFolder) {
      if (Meteor.call('isAdmin')) {
        //Transverse destination folder parents to see if folder is contained within the source folder
        var invalidOperation = false;
        if (destinationFolder == null) {
          Folders.update(movingFolder, {
            $set: {
              parent: null
            }
          });
          return "Success";
        }
        if (destinationFolder == movingFolder) {
          return "You cannot move a folder into itself."
        }
        var currentTransversalFolderId = Folders.findOne(destinationFolder).parent;
        while (typeof(currentTransversalFolderId) !== "undefined") {
          console.log("Transversed once");
          if (currentTransversalFolderId == movingFolder) {
            console.log("Yay");
            invalidOperation = true;
            break;
          } else {
            currentTransversalFolderId = Folders.findOne(currentTransversalFolderId);
            console.log(typeof(currentTransversalFolderId));
            if (typeof(currentTransversalFolderId) !== "undefined") {
              currentTransversalFolderId = currentTransversalFolderId.parent;
              console.log(currentTransversalFolderId);
            }
          }
        }
        //check if invalid bool is set
        if (invalidOperation) {
          return "You cannot move a parent folder into any of it's children";
        } else {
          Folders.update(movingFolder, {
            $set: {
              parent: destinationFolder
            }
          });
          return "Success";
        }
      } else {
        return "You must be an administrator to move folders."
      }
    },
    //Utility function which provides quick access to make users administrators
    makeUserAdmin: function(userId) {
      if (Meteor.call('isAdmin')) {
        Meteor.users.update({
          _id: userId
        }, {
          $set: {
            "profile.type": "admin"
          }
        }, function(err) {
          if (err) {
            return err;
          } else {
            return "The user was successfully updated.";
          }
        });
      } else {
        return "You must be an admin to do that.";
      }
    }
  });
}