function LightFieldRenderer() {
	this.image = null;
	this.typedArrayImage = null; //CHANGE
	this.optics = {};
	this.lenslets = {};

	this.loaded = {}; // indexed by variable name
	this.texture = {}; // GL texture cache; indexed by mode name

	this.view2d = {
		'mouseSensitivity': 50.0,

		'center_X': 0.0,
		'center_Y': 0.0,

		'mousedrag_X': undefined,
		'mousedrag_Y': undefined
	};
	this.view3d = {
		'mouseSensitivity': 4.0,

		// OpenGL coordinate system (0.0 is the middle)
		'ofs_U': 0.0,
		'ofs_V': 0.0,

		'mousedrag_X': undefined,
		'mousedrag_Y': undefined
	};
};

var lf_baseurl = "http://nemaload.cachefly.net/";
//CHANGE
LightFieldRenderer.prototype.loadimage_xhr = function(imagepath) {
	var obj = this;
	this.loaded = {
		"image": 0,
		"optics": 0,
		"lenslets": 0
	};

	console.log("Beginning XHR image load");
	var xhr = new XMLHttpRequest();
	console.log("LOADING IMAGE FROM: " + lf_baseurl + imagepath + "-" + Session.get("currentFrameIndex") + ".png");
	xhr.open("GET", lf_baseurl + imagepath + "-" + Session.get("currentFrameIndex") + ".png", true);
	xhr.responseType = 'arraybuffer';
	xhr.onload = function(e) {
		console.log("XHR loaded with status " + this.status);
		if (this.status == 200) {
			obj.typedArrayImage = new Uint8Array(this.response);

			for (var i = 0, len = obj.typedArrayImage.length; i < len; ++i) {
				//obj.typedArrayImage[i] = this.response[i];
			}
			var byte3 = obj.typedArrayImage[4];
			console.log("processing done for xhr image load");
			console.log("length of buffer is " + obj.typedArrayImage.byteLength + "in bytes");
			obj.render_if_ready_xhr(1);
		}
	}
	xhr.send(); //initiate the image load
	this.optics = {
		"pitch": Session.get("op_pitch"),
		"flen": Session.get("op_flen"),
		"mag": Session.get("op_mag"),
		"abbe": Session.get("op_abbe"),
		"na": Session.get("op_na"),
		"medium": Session.get("op_medium")
	};
	this.loaded.optics = 1;
	this.lenslets = {
		"offset": [Session.get("op_x_offset"), Session.get("op_y_offset")],
		"right": [Session.get("op_right_dx"), Session.get("op_right_dy")],
		"down": [Session.get("op_down_dx"), Session.get("op_down_dy")]
	};
	this.loaded.lenslets = 1;
	console.log("exiting function...");
	//this.render_if_ready_xhr(1);
}
//CHANGE
LightFieldRenderer.prototype.loadimage = function(imagepath) {
	//overriding original method
	console.log("Switching to loadimage_xhr");
	this.loadimage_xhr(imagepath);
	console.log("returned?");
	return;

	var obj = this;

	// This method of asynchronous loading may be problematic if there
	// is still an outstanding request from previous loadimage(); FIXME
	this.loaded = {
		"image": 0,
		"optics": 0,
		"lenslets": 0
	};
	$("#imageLoading" + Session.get("currentFrameIndex")).removeClass("notLoaded").addClass("loading");
	this.image = new Image();
	this.image.crossOrigin = "anonymous";
	this.image.onload = function() {
		obj.loaded.image = 1;
		obj.render_if_ready(1);
		$("#imageLoading" + Session.get("currentFrameIndex")).removeClass("notLoaded").removeClass("loading").addClass("loaded");
	};
	/* Not supported yet :(
	this.image.onloadstart = function() {
		alert("loading started! logging to console");
	};
	this.image.onloadprogress = function(e) 
	{ 
		console.log(e.loaded);
	};
	this.image.onloadend = function () {
		alert("Loading ended!");
	};*/
	this.image.src = lf_baseurl + imagepath + "-" + Session.get("currentFrameIndex") + ".png";
	this.optics = {
		"pitch": Session.get("op_pitch"),
		"flen": Session.get("op_flen"),
		"mag": Session.get("op_mag"),
		"abbe": Session.get("op_abbe"),
		"na": Session.get("op_na"),
		"medium": Session.get("op_medium")
	};
	this.loaded.optics = 1;
	this.lenslets = {
		"offset": [Session.get("op_x_offset"), Session.get("op_y_offset")],
		"right": [Session.get("op_right_dx"), Session.get("op_right_dy")],
		"down": [Session.get("op_down_dx"), Session.get("op_down_dy")]
	};
	this.loaded.lenslets = 1;
	this.render_if_ready(1);
}

LightFieldRenderer.prototype.render_if_ready = function(is_new_image) {
	console.log("Switching rendering if ready to XHR version...");
	this.render_if_ready_xhr(is_new_image);
	return;
	console.log("loadimage " + this.loaded.image + " " + this.loaded.optics + " " + this.loaded.lenslets);
	if (!this.loaded.image || !this.loaded.optics || !this.loaded.lenslets)
		return;
	this.render(is_new_image);
}

LightFieldRenderer.prototype.render_if_ready_xhr = function(is_new_image) {
	//console.log("loadimage " + this.loaded.image + " " + this.loaded.optics + " " + this.loaded.lenslets);

	if (!this.loaded.typedArrayImage || !this.loaded.optics || !this.loaded.lenslets)
		return;
	this.render_xhr(is_new_image);
}

LightFieldRenderer.prototype.setUV = function(U, V) {
	var newofs_U = U;
	var newofs_V = V;

	var rel_U = newofs_U / this.lenslets.right[0];
	var rel_V = newofs_V / this.lenslets.down[1];
	var UV_dist = rel_U * rel_U + rel_V * rel_V;
	var max_slope = this.maxNormalizedSlope();
	if (UV_dist > max_slope * max_slope) {
		console.log(UV_dist + " > " + max_slope * max_slope)
		return;
	}

	this.view3d.ofs_U = newofs_U;
	this.view3d.ofs_V = newofs_V;
	this.render(0);
	this.updateUV_display();
}

LightFieldRenderer.prototype.updateUV = function(delta_U, delta_V) {
	this.setUV(this.view3d.ofs_U + delta_U, this.view3d.ofs_V + delta_V);
}

LightFieldRenderer.prototype.updateUV_display = function() {
	$('#U_current').html(parseFloat(this.view3d.ofs_U).toFixed(2));
	$('#V_current').html(parseFloat(this.view3d.ofs_V).toFixed(2));

	var canvas = document.getElementById("canvas-uvpos");
	var cuvpos = canvas.getContext("2d");
	cuvpos.clearRect(0, 0, canvas.width, canvas.height);

	var cradius = (canvas.width - 2) / 2;
	cuvpos.beginPath();
	cuvpos.arc(cradius + 1, cradius + 1, cradius, 0, 2 * Math.PI);
	cuvpos.stroke();

	var pos_x, pos_y;
	if (this.optics != null && this.lenslets != null) {
		var rel_U = this.view3d.ofs_U / this.lenslets.right[0];
		var rel_V = this.view3d.ofs_V / this.lenslets.down[1];
		var max_slope = this.maxNormalizedSlope();
		pos_x = canvas.width / 2 + cradius * rel_U / max_slope;
		pos_y = canvas.height / 2 - cradius * rel_V / max_slope;
	} else {
		/* UV coordinates make no sense yet, just draw a point in the middle. */
		pos_x = canvas.width / 2;
		pos_y = canvas.height / 2;
	}
	cuvpos.beginPath();
	cuvpos.arc(pos_x, pos_y, 2, 0, Math.PI * 2, true);
	cuvpos.closePath();
	cuvpos.fill();
}

LightFieldRenderer.prototype.updateCenter = function(delta_X, delta_Y) {
	var newcenter_X = this.view2d.center_X + delta_X;
	var newcenter_Y = this.view2d.center_Y + delta_Y;

	if (newcenter_X >= 1. || newcenter_X <= -1. || newcenter_Y >= 1. || newcenter_Y <= -1.) {
		console.log("out of bounds ", newcenter_X, newcenter_Y);
		return;
	}

	this.view2d.center_X = newcenter_X;
	this.view2d.center_Y = newcenter_Y;
	this.render(0);
}

LightFieldRenderer.prototype.mousedrag_set = function(new_X, new_Y) {
	if (mode == "image") {
		this.view2d.mousedrag_X = new_X;
		this.view2d.mousedrag_Y = new_Y;
	} else {
		this.view3d.mousedrag_X = new_X;
		this.view3d.mousedrag_Y = new_Y;
	}
}
LightFieldRenderer.prototype.mousedrag = function(new_X, new_Y) {
	if (mode == "image") {
		if (this.view2d.mousedrag_X) {
			var canvas = document.getElementById("canvas-image");
			this.updateCenter(-(new_X - this.view2d.mousedrag_X) / canvas.width, (new_Y - this.view2d.mousedrag_Y) / canvas.height);
		}
		this.view2d.mousedrag_X = new_X;
		this.view2d.mousedrag_Y = new_Y;
	} else {
		if (this.view3d.mousedrag_X) {
			this.updateUV((new_X - this.view3d.mousedrag_X) / this.view3d.mouseSensitivity, -(new_Y - this.view3d.mousedrag_Y) / this.view3d.mouseSensitivity);
		}
		this.view3d.mousedrag_X = new_X;
		this.view3d.mousedrag_Y = new_Y;
	}
}

LightFieldRenderer.prototype.maxNormalizedSlope = function() {
	/* Return the maximum slope afforded by the optical system */

	// ???
	var image_na = this.optics.na / this.optics.mag;
	if (image_na >= 1.0) return 0.0;
	var na_slope = image_na / Math.sqrt(1.0 - image_na * image_na);

	// slope of looking at a lens neighboring with central lens
	var ulens_slope = this.optics.pitch / this.optics.flen;

	return na_slope / ulens_slope;
}

LightFieldRenderer.prototype.lenslets_offset2corner = function() {
	/* Walk from the lenslets.offset point to the point of the grid
	 * nearest to the top left corner. */

	var lenslets = this.lenslets;
	var corner = lenslets.offset.slice();
	var changed;
	do {
		changed = false;
		if (corner[1] > corner[0] && corner[0] > lenslets.down[0] && corner[1] > lenslets.down[1]) {
			corner[0] -= lenslets.down[0];
			corner[1] -= lenslets.down[1];
			changed = true;
		}
		if (corner[0] > lenslets.right[0] && corner[1] > lenslets.right[1]) {
			corner[0] -= lenslets.right[0];
			corner[1] -= lenslets.right[1];
			changed = true;
		}
		if (corner[1] > corner[0] && corner[0] > lenslets.down[0] && corner[1] > lenslets.down[1]) {
			corner[0] -= lenslets.down[0];
			corner[1] -= lenslets.down[1];
			changed = true;
		}
	} while (changed);
	/* FIXME: Note that we might get stuck at a point where we e.g. still have
	 * some room to go many steps up at the cost of going one step right. */

	console.log("lenslets " + JSON.stringify(lenslets) + " -> corner offset " + corner);

	return corner;
}


LightFieldRenderer.prototype.render = function(is_new_image) {
	//grabs the canvas element
	//CHANGE redirecting to render_xhr
	console.log("Switching to render xhr");
	this.render_xhr(is_new_image);
	return;
	var canvas = document.getElementById("canvas-" + mode);
	canvas.height = canvas.width * this.image.height / this.image.width;

	//gets the WebGL context
	var gl = getWebGLContext(canvas);
	//checks if system is WebGL compatible
	if (!gl) {
		alert("WebGL not supported in this browser, sorry");
		return;
	}

	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	gl.enable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);

	if (mode == "image") {
		this.render_image(canvas, gl);
	} else {
		this.render_lightfield_pinhole(canvas, gl);
	}

	if (1) { // is_new_image) { TODO: <canvas> must persist re-renders for this to work properly
		if (this.texture[mode]) {
			gl.deleteTexture(this.texture[mode]);
		}
		this.texture[mode] = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture[mode]);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
	} else {
		gl.bindTexture(gl.TEXTURE_2D, this.texture[mode]);
	}
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	//if (mode == "image" && $('#grid').prop('checked'))
	if (mode == "image" && Session.get('showGrid'))
		this.render_grid(canvas, gl);
}

//CHANGE
LightFieldRenderer.prototype.render_xhr = function(is_new_image) {
	//grab the canvas element
	var canvas = document.getElementById("canvas-" + mode);
	var tempCanvasWidth = 2560; //!!CHANGE THIS
	var tempCanvasHeight = 2160;
	canvas.height = canvas.width * tempCanvasHeight / tempCanvasWidth;

	//gets the WebGL context
	var gl = getWebGLContext(canvas);
	//checks if system is WebGL compatible
	if (!gl) {
		alert("WebGL not supported in this browser, sorry");
		return;
	}

	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	gl.enable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);

	if (mode == "image") {
		this.render_image(canvas, gl);
	} else {
		alert("only image rendering available at this time with typed array buffers");
		return;
		this.render_lightfield_pinhole(canvas, gl);
	}

	if (1) { // is_new_image) { TODO: <canvas> must persist re-renders for this to work properly
		console.log("BEGINNING XHR OPENGL STUFF");
		if (this.texture[mode]) {
			gl.deleteTexture(this.texture[mode]);
		}
		this.texture[mode] = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture[mode]);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		//gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
		//the call below doesn't work with typed arrays
		/*gl.texImage2D(
			gl.TEXTURE_2D, //target
			0, //mip level
			gl.RGBA, //internal format
			gl.RGBA, //format
			gl.UNSIGNED_BYTE, //type
			this.typedArrayImage //data
		);*/
		gl.texImage2D(
			gl.TEXTURE_2D, //target
			0, //mip level
			gl.RGBA, //internal format
			2560, //width MAKE THESE DYNAMIC
			2160, //height
			0, //border
			gl.RGBA, //format
			gl.UNSIGNED_BYTE, //type
			this.typedArrayImage
			);

	} else {
		gl.bindTexture(gl.TEXTURE_2D, this.texture[mode]);
	}
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	console.log("FINISHED XHR OPENGL STUFF");
	//if (mode == "image" && $('#grid').prop('checked'))
	if (mode == "image" && Session.get('showGrid'))
		this.render_grid(canvas, gl);



}

LightFieldRenderer.prototype.render_image = function(canvas, gl) {
	// compile shaders
	vertexShader = createShaderFromScriptElement(gl, "image-vertex-shader");
	fragmentShader = createShaderFromScriptElement(gl, "lf-image-fragment-shader");
	program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	// set(up) parameters
	var canvSizeLocation = gl.getUniformLocation(program, "u_canvSize");
	gl.uniform2f(canvSizeLocation, canvas.width, canvas.height);
	var gammaGainLocation = gl.getUniformLocation(program, "u_gammaGain");
	gl.uniform2f(gammaGainLocation, parseFloat(Session.get("currentImageGamma")), Math.pow(10, parseFloat(Session.get("currentImageGain"))));
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, this.view2d.center_X, this.view2d.center_Y,
		Math.pow(10, parseFloat(Session.get("currentImageZoom"))));

	var texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	setRectangle(gl, 0.0, 0.0, 1.0, 1.0);
	var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var canvCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, canvCoordBuffer);
	setRectangle(gl, 0, 0, canvas.width, canvas.height);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

LightFieldRenderer.prototype.render_lightfield_pinhole = function(canvas, gl) {
	// compile shaders
	vertexShader = createShaderFromScriptElement(gl, "image-vertex-shader");
	fragmentShader = createShaderFromScriptElement(gl, "lf-pinhole-fragment-shader");
	program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	var gridCorner = this.lenslets_offset2corner();
	var gridSize = {
		"width": Math.ceil(this.image.width / this.lenslets.right[0]),
		"height": Math.ceil(this.image.height / this.lenslets.down[1])
	};

	// set(up) parameters
	var canvSizeLocation = gl.getUniformLocation(program, "u_canvSize");
	gl.uniform2f(canvSizeLocation, canvas.width, canvas.height);
	var gammaGainLocation = gl.getUniformLocation(program, "u_gammaGain");
	gl.uniform2f(gammaGainLocation, parseFloat(Session.get("currentImageGamma")), Math.pow(10, parseFloat(Session.get("currentImageGain"))));
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, 0., 0., 1.);

	var gridSizeLocation = gl.getUniformLocation(program, "u_gridSize");
	gl.uniform2f(gridSizeLocation, gridSize.width, gridSize.height);
	var rectOffsetLocation = gl.getUniformLocation(program, "u_rectOffset");
	gl.uniform2f(rectOffsetLocation, gridCorner[0] / this.image.width, -gridCorner[1] / this.image.height);
	var rectLinearLocation = gl.getUniformLocation(program, "u_rectLinear");
	gl.uniformMatrix2fv(rectLinearLocation, false, [this.lenslets.right[0] / this.image.width,
		this.lenslets.right[1] / this.image.height,
		this.lenslets.down[0] / this.image.width,
		this.lenslets.down[1] / this.image.height
	]);
	var UVCoordLocation = gl.getUniformLocation(program, "u_UVCoord");
	gl.uniform2f(UVCoordLocation, this.view3d.ofs_U / this.lenslets.right[0], this.view3d.ofs_V / this.lenslets.down[1]);

	var texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	setRectangle(gl, 0.0, 0.0, 1.0, 1.0);
	var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var canvCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, canvCoordBuffer);
	setRectangle(gl, 0, 0, canvas.width, canvas.height);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

LightFieldRenderer.prototype.render_grid = function(canvas, gl) {
	var vertexShader = createShaderFromScriptElement(gl, "lf-grid-vertex-shader");
	var fragmentShader = createShaderFromScriptElement(gl, "lf-grid-fragment-shader");
	var program = createProgram(gl, [vertexShader, fragmentShader]);
	gl.useProgram(program);

	var gridCorner = this.lenslets_offset2corner();
	if (Session.get('showGridUV')) {
		gridCorner[0] += this.view3d.ofs_U;
		gridCorner[1] += this.view3d.ofs_V;
	}

	var gridSize = {
		"width": Math.ceil(this.image.width / this.lenslets.right[0]),
		"height": Math.ceil(this.image.height / this.lenslets.down[1])
	};
	console.log("grid corner " + gridCorner + " size " + gridSize);
	var lineList = new Array;
	for (var x = 0; x <= gridSize.width; x++) {
		lineList.push(gridCorner[0] + x * this.lenslets.right[0]);
		lineList.push(gridCorner[1] + x * this.lenslets.right[1]);
		lineList.push(gridCorner[0] + x * this.lenslets.right[0] + gridSize.height * this.lenslets.down[0]);
		lineList.push(gridCorner[1] + x * this.lenslets.right[1] + gridSize.height * this.lenslets.down[1]);
	}
	for (var y = 0; y <= gridSize.height; y++) {
		lineList.push(gridCorner[0] + y * this.lenslets.down[0]);
		lineList.push(gridCorner[1] + y * this.lenslets.down[1]);
		lineList.push(gridCorner[0] + y * this.lenslets.down[0] + gridSize.width * this.lenslets.right[0]);
		lineList.push(gridCorner[1] + y * this.lenslets.down[1] + gridSize.width * this.lenslets.right[1]);
	}

	var gridLinesBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gridLinesBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineList), gl.STATIC_DRAW);
	var canvCoordLocation = gl.getAttribLocation(program, "a_canvCoord");
	gl.enableVertexAttribArray(canvCoordLocation);
	gl.vertexAttribPointer(canvCoordLocation, 2, gl.FLOAT, false, 0, 0);

	var imageSizeLocation = gl.getUniformLocation(program, "u_imageSize");
	gl.uniform2f(imageSizeLocation, this.image.width, this.image.height);
	var zoomLocation = gl.getUniformLocation(program, "u_zoom");
	gl.uniform3f(zoomLocation, this.view2d.center_X, this.view2d.center_Y,
		Math.pow(10, parseFloat(Session.get("currentImageZoom"))));

	gl.drawArrays(gl.LINES, 0, lineList.length / 2);
}