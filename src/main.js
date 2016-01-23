/*jshint -W079 */
/*jshint -W082 */
var module = module || {},
    window = window || {},
    jQuery = jQuery || {},
    tableau = tableau || {},
    wdcw = window.wdcw || {},
    gapi = window.gapi || {},
    URI = window.URI || {};

module.exports = function($, tableau, gapi, wdcw, URI) {
  var initialized = false,
      connector;

  /**
   * Run during initialization of the web data connector.
   *
   * @param {string} phase
   *   The initialization phase. This can be one of:
   *   - tableau.phaseEnum.interactivePhase: Indicates when the connector is
   *     being initialized with a user interface suitable for an end-user to
   *     enter connection configuration details.
   *   - tableau.phaseEnum.gatherDataPhase: Indicates when the connector is
   *     being initialized in the background for the sole purpose of collecting
   *     data.
   *   - tableau.phaseEnum.authPhase: Indicates when the connector is being
   *     accessed in a stripped down context for the sole purpose of refreshing
   *     an OAuth authentication token.
   * @param {function} setUpComplete
   *   A callback function that you must call when all setup tasks have been
   *   performed.
   */
  wdcw.setup = function setup(phase, setUpComplete) {
    connector = this;

    // connector.setIncrementalExtractColumn('date');

    // You may need to perform set up or other initialization tasks at various
    // points in the data connector flow. You can do so here.
    switch (phase) {
      case tableau.phaseEnum.interactivePhase:
        // Perform actual interactive phase stuff, but only once.
        if (!initialized) {
          initialized = true;
          wdcw._setUpInteractivePhase();
        }
        break;

      case tableau.phaseEnum.gatherDataPhase:
        // Perform set up tasks that should happen when Tableau is attempting to
        // retrieve data from your connector (the user is not prompted for any
        // information in this phase.
        break;

      case tableau.phaseEnum.authPhase:
        // Perform set up tasks that should happen when Tableau is attempting to
        // refresh OAuth authentication tokens.
        break;
    }

    // Always register when initialization tasks are complete by calling this.
    // This can be especially useful when initialization tasks are asynchronous
    // in nature.
    setUpComplete();
  };

  /**
   * Actual interactive phase setup code. Mostly separated for testability, but
   * tests still TBD...
   */
  wdcw._setUpInteractivePhase = function setUpInteractivePhase() {
    var $modal = $('div.modal'),
        $signIn = $('#sign-in'),
        $form = $('form'),
        recoverFromError = function recoverFromError() {
          $modal.find('h3').text('There was a problem authenticating.');
          setTimeout(function () {
            $modal.modal('hide');
          }, 2000);
        },
        params,
        uri;

    if (connector.getPassword()) {
      $modal.modal('show');

      $.ajax({
        url: '/reports',
        type: 'POST',
        headers: {
          'Connection': 'close',
          'Content-type': 'application/json; charset=utf-8'
        },
        data: connector.getPassword(),
        timeout: 0
      }).done(wdcw._handleInitialUI).fail(recoverFromError);
      return;
    }

    // Add a handler to detect and initiate oauth flow.
    $signIn.on('click press', function (event) {
      // Send the user to the Google authentication page (for oauth).
      window.location = '/authorize';
    });

    // Listen for oauth flow indicators from Google.
    uri = new URI(window.location.href);
    if (uri.hasQuery('code')) {
      params = uri.search(true);

      // Pop a modal indicating that we're attempting to authenticate.
      $modal.modal('show');

      // Attempt to negotiate with Google to pull an auth token.
      $.ajax({
        url: '/tokenize',
        type: 'POST',
        headers: {
          'Connection': 'close',
          'Content-type': 'application/json; charset=utf-8'
        },
        data: JSON.stringify({code: params.code}),
        timeout: 0
      }).done(wdcw._handleOauthToken).fail(recoverFromError);
    }
  };

  /**
   * AJAX response handler for
   * @param response
   * @private
   */
  wdcw._handleOauthToken = function handleOauthToken(response) {
    var uri = new URI(window.location.href);

    // Set the connection password to the returned token value.
    connector.setPassword(JSON.stringify(response));
    $('#password').val(JSON.stringify(response)).change();

    // Push a window history change so Tableau remembers the bare URL
    // as the connection location, not the one that includes a "code"
    // param as returned by Google during initial authentication.
    window.history.pushState({}, '', uri.protocol() + '://' + uri.authority());

    // Return available reports.
    $.ajax({
      url: '/reports',
      type: 'POST',
      headers: {
        'Connection': 'close',
        'Content-type': 'application/json; charset=utf-8'
      },
      data: JSON.stringify(response),
      timeout: 0
    }).done(wdcw._handleInitialUI).fail(connector.ajaxErrorHandler);
  };

  wdcw._handleInitialUI = function handleInitialUI(response) {
    var $modal = $('div.modal'),
        $signIn = $('#sign-in'),
        $form = $('form'),
        $report = $('#report');

    // Set the profileID.
    $('#username').val(response.profileId).change();
    connector.setUsername(response.profileId);

    response.items.forEach(function(item) {
      var $option = $('<option>')
          .attr('value', item.id)
          .text(item.name);
      $report.append($option);
    });

    $modal.modal('hide');
    $signIn.hide();
    $form.find('input, select').not('#password, #username').show();
  };

  /**
   * Run when the web data connector is being unloaded. Useful if you need
   * custom logic to clean up resources or perform other shutdown tasks.
   *
   * @param {function} tearDownComplete
   *   A callback function that you must call when all shutdown tasks have been
   *   performed.
   */
  wdcw.teardown = function teardown(tearDownComplete) {
    // Once shutdown tasks are complete, call this. Particularly useful if your
    // clean-up tasks are asynchronous in nature.
    tearDownComplete();
  };

  /**
   * Primary method called when Tableau is asking for the column headers that
   * this web data connector provides. Takes a single callable argument that you
   * should call with the headers you've retrieved.
   *
   * @param {function(Array<{name, type, incrementalRefresh}>)} registerHeaders
   *   A callback function that takes an array of objects as its sole argument.
   *   For example, you might call the callback in the following way:
   *   registerHeaders([
   *     {name: 'Boolean Column', type: 'bool'},
   *     {name: 'Date Column', type: 'date'},
   *     {name: 'DateTime Column', type: 'datetime'},
   *     {name: 'Float Column', type: 'float'},
   *     {name: 'Integer Column', type: 'int'},
   *     {name: 'String Column', type: 'string'}
   *   ]);
   *
   *   Note: to enable support for incremental extract refreshing, add a third
   *   key (incrementalRefresh) to the header object. Candidate columns for
   *   incremental refreshes must be of type datetime or integer. During an
   *   incremental refresh attempt, the most recent value for the given column
   *   will be passed as "lastRecord" to the tableData method. For example:
   *   registerHeaders([
   *     {name: 'DateTime Column', type: 'datetime', incrementalRefresh: true}
   *   ]);
   */
  wdcw.columnHeaders = function columnHeaders(registerHeaders) {
    $.ajax({
      url: '/headers',
      type: 'POST',
      headers: {
        'Connection': 'close',
        'Content-type': 'application/json; charset=utf-8'
      },
      data: JSON.stringify({
        auth: JSON.parse(connector.getPassword()),
        reportId: connector.getConnectionData().report,
        profileId: connector.getUsername()
      }),
      timeout: 0
    }).done(function gotHeaders(headers) {
      registerHeaders(headers);
    }).fail(this.ajaxErrorHandler);
  };


  /**
   * Primary method called when Tableau is asking for your web data connector's
   * data. Takes a callable argument that you should call with all of the
   * data you've retrieved. You may optionally pass a token as a second argument
   * to support paged/chunked data retrieval.
   *
   * @param {function(Array<{object}>, {string})} registerData
   *   A callback function that takes an array of objects as its sole argument.
   *   Each object should be a simple key/value map of column name to column
   *   value. For example, you might call the callback in the following way:
   *   registerData([
   *     {'String Column': 'String Column Value', 'Integer Column': 123}
   *   ]});
   *
   *   It's possible that the API you're interacting with supports some mechanism
   *   for paging or filtering. To simplify the process of making several paged
   *   calls to your API, you may optionally pass a second argument in your call
   *   to the registerData callback. This argument should be a string token that
   *   represents the last record you retrieved.
   *
   *   If provided, your implementation of the tableData method will be called
   *   again, this time with the token you provide here. Once all data has been
   *   retrieved, pass null, false, 0, or an empty string.
   *
   * @param {string} lastRecord
   *   Optional. If you indicate in the call to registerData that more data is
   *   available (by passing a token representing the last record retrieved),
   *   then the lastRecord argument will be populated with the token that you
   *   provided. Use this to update/modify the API call you make to handle
   *   pagination or filtering.
   *
   *   If you indicated a column in wdcw.columnHeaders suitable for use during
   *   an incremental extract refresh, the last value of the given column will
   *   be passed as the value of lastRecord when an incremental refresh is
   *   triggered.
   */
  wdcw.tableData = function tableData(registerData, lastRecord) {
    $.ajax({
      url: '/data',
      type: 'POST',
      headers: {
        'Connection': 'close',
        'Content-type': 'application/json; charset=utf-8'
      },
      data: JSON.stringify({
        auth: JSON.parse(connector.getPassword()),
        reportId: connector.getConnectionData().report,
        profileId: connector.getUsername()
      }),
      timeout: 0
    }).done(function gotData(response) {
      registerData(response);
    }).fail(function notGotData(foo, bar, baz) {
      tableau.abortWithError(JSON.stringify([foo, bar, baz]));
    });
  };

  return wdcw;
};

// Set the global wdcw variable as expected.
wdcw = module.exports(jQuery, tableau, gapi, wdcw, URI);
