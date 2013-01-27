/**
 * Load JSON data and dispatch EDB types.
 * TODO: support localstorage as alternative to server
 * @param {Window} context Might be a worker context
 * @deprecated
 */
edb.Service = function Service ( context ) {

	if ( context ) {
		this._context = context;
		this._request = new gui.Request ().acceptJSON ();
	} else {
		throw new Error ( "NO!" );
	}
};

edb.Service.prototype = {

	/**
	 * Window or worker context.
	 * @type {Window}
	 */
	_context : null,

	/**
	 * edb.Model constructor.
	 * @type {function}
	 */
	_model : null,

	/**
	 * Raw or modelled data.
	 * @type {object|edb.Model}
	 */
	_data : null,

	/**
	 * HTTP request (defaults to JSON).
	 * @type {gui.Request}
	 * @type {[type]}
	 */
	_request : null,

	/**
	 * Dispatch if or when data is available?
	 * @type {boolean}
	 */
	_dodispatch : false,

	/**
	 * GET data from server (optionally preparsed in a callback function).
	 * @param @optional {String} href TODO: custom protocol for localstorage
	 * @param @optional {function} ondata Function to input JSON and return JSON
	 * @param @optional {object} thisp
	 * @returns {edb.Service}
	 */
	get : function ( href, ondata, thisp ) {
		var request = this._request.url ( href );
		request.get ( function ( status, data ) {
			if ( ondata ) {
				data = ondata.call ( thisp, status, data );
				if ( !gui.Type.isDefined ( data )) {
					throw new Error ( "Return type expected" );
				}
			}
			this._data = data;
			if ( this._dodispatch ) {
				this._dispatch ();
			}
		}, this );
		return this;
	},

	/**
	 * Dispatch data as 
	 * @param {object} model edb.Model constructor or string of type "my.data.Thing"
	 * @type {edb.Model} model
	 */
	dispatch : function ( model ) {
		this._model = model || null;
		this._dodispatch = true;
		if ( this._data ) {
			this._dispatch ();
		}
	},


	// PRIVATES ...................................................................

	/**
	 * Output something to page.
	 */
	_dispatch : function () {
		if ( this._dodispatch && this._data ) {
			var output = new edb.Output ();
			output.context = this._context;
			output.dispatch ( this._data, this._model );
		}
	}
};

/**
 * Injecting methods to configure request.
 */
( function generatecode () {
	[ "accept", "acceptJSON", "acceptXML", "acceptText" ].forEach ( function ( method ) {
		edb.Service.prototype [ method ] = function () {
			this._request [ method ].apply ( this._request, arguments );
			return this;
		}
	});
})();
