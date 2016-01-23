// Generated on 2016-01-21 using generator-web-data-connector 1.0.1

'use strict';

module.exports = function(grunt) {

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        'js/*.js',
        '!js/scripts.min.js'
      ]
    },
    concat: {
      js: {
        options: {
          separator: ';'
        },
        src: [
          'bower_components/jquery/dist/jquery.js',
          'bower_components/tableau/dist/tableauwdc-1.1.0.js',
          'bower_components/tether/dist/js/tether.js',
          'bower_components/bootstrap/dist/js/bootstrap.js',
          'bower_components/uri.js/src/URI.js',
          'src/wrapper.js',
          'src/**/*.js'
        ],
        dest: 'build/all.js'
      }
    },
    uglify: {
      options: {
        compress: true,
        mangle: true,
        sourceMap: true
      },
      target: {
        src: 'build/all.js',
        dest: 'build/all.min.js'
      }
    },
    express: {
      server: {
        options: {
          script: 'index.js',
            port: 9001
        }
      }
    },
    watch: {
      scripts: {
        files: 'src/**/*.js',
        tasks: [
          'jshint',
          'concat',
          'uglify',
          'express:server'
        ],
        options: {
          spawn: false
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', [
    'build',
    'run'
  ]);

  grunt.registerTask('run', [
    'express:server',
    'watch'
  ]);

  grunt.registerTask('build', [
    'jshint',
    'concat',
    'uglify'
  ]);
};
