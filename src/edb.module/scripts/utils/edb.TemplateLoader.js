/**
 * The template loader will fetch a template string from an external 
 * document or scan the local document for templates in SCRIPT tags.
 * @extends {gui.FileLoader}
 */
edb.TemplateLoader = gui.FileLoader.extend ({

	/**
	 * Mapping script element attributes to be used as compiler directives. 
	 * @type {Map<String,object>}
	 */
	directives : null,

	/**
	 * Load script source as text/plain.
	 * @overwrites {gui.FileLoader#load}
	 * @param {String} src
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	load : function ( src, callback, thisp ) {
		var url = new gui.URL ( this._document, src );
		if ( this._cache.has ( url.location )) {
			this._cached ( url, callback, thisp );
		} else if ( url.external ) {				
			this._request ( url, callback, thisp );
		} else if ( url.hash ) {
			this._lookup ( url, callback, thisp );
		} else {
			console.error ( "Now what?" );
		}
	},

	/**
	 * Handle loaded script source; externally loaded file may contain multiple scripts.
	 * @overwrites {gui.FileLoader#onload}
	 * @param {String} text
	 * @param {gui.URL} url
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	onload : function ( text, url, callback, thisp ) {
		if ( url.external ) {
			text = this._extract ( text, url );
		}
		callback.call ( thisp, text, this.directives );
		this.directives = null;
	},
	

	// PRIVATES ........................................................................
	
	/**
	 * Lookup script in document DOM (as opposed to HTTP request).
	 * @param {gui.URL} url
	 * @param {Map<String,String>} cache
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	_lookup : function ( url, callback, thisp ) {
		var script = this._document.querySelector ( url.hash );
		this.directives = gui.AttPlugin.getmap ( script );
		this.onload ( script.textContent, url, callback, thisp );
	},

	/**
	 * EDBML templates are loaded as HTML documents with one or more script 
	 * tags. The requested script should have an @id to match the URL #hash.  
	 * If no hash was given, we return the source code of first script found.
	 * @param {String} text HTML with one or more script tags
	 * TODO: cache this stuff for repeated lookups!
	 * @param {gui.URL} url
	 * @returns {String} Template source code
	 */
	_extract : function ( text, url ) {
		var temp = this._document.createElement ( "div" );
		temp.innerHTML = text;
		var script = temp.querySelector ( url.hash || "script" );
		if ( script ) {	
			this.directives = gui.AttPlugin.getmap ( script );
			return script.textContent;
		} else {
			console.error ( "No such script: " + url.location + url.hash || "" );
		}
	}


}, {}, { // STATICS ....................................................
	
	/**
	 * @static
	 * Mapping scriptloaders to mimetypes.
	 * @type {Map<String,edb.BaseLoader>}
	 */
	_loaders : new Map (),

	/**
	 * @static
	 * Register scriptloader for one or more mimetypes. 
	 * TODO: rename!
	 */
	set : function () { // implementation, ...mimetypes
		var args = gui.Object.toArray ( arguments );
		var impl = args.shift ();
		args.forEach ( function ( type ) {
			this._loaders.set ( type, impl );
		}, this );
	},
		
	/**
	 * @static
	 * Get loader for mimetype (what corresponds 
	 * to the "type" attribute of a script tag),
	 * TODO: rename!
	 * @param {String} type
	 * @returns {edb.BaseLoader}
	 */
	get : function ( type ) {
		var impl = edb.BaseLoader;
		if ( type ) {
			impl = this._loaders.get ( type );
			if ( !impl ) {
				throw new Error ( "No script loader registered for type: " + type );
			}
		}
		return impl;
	}
});