/**
 * Load JSON data and dispatch EDB types.
 * TODO: support localstorage as alternative to server
 * @param {Window} context Might be a worker context
 */
edb.Service = function Service ( context ) {

	this._context = context;
}

edb.Service.prototype = {

	/**
	 * Window or worker context.
	 * @type {Window}
	 */
	_context : null,

	/**
	 * @static
	 * Fetch JSON from server and output EDB types in context document.
	 * @param {object} type edb.Model constructor or string of type "my.data.Thing"
	 * @param @optional {String} href
	 */
	get : function ( type, href ) {
		
		// lookup type in context.
		var output = new edb.Output ();
		output.context = this._context;
		output.type ( type );

		// TODO: ref to edb.ServiceSpirit as "target" of dispatch in edb.Output!

		if ( href ) {
			new gui.Request ( href ).acceptJSON ().get ( function ( status, data, text ) {
				output.dispatch ( data );
			}, this ); 
		} else {
			output.dispatch ();
		}
	}
};