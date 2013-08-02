'use strict';

exports.run = function(grunt, taskData) {
    var EC2_INSTANCE_LAUNCH_FAIL = '✗'.red + ' EC2 instance launched failed with %s';
    var EC2_INSTANCE_LAUNCH_SUCCESS = '↗'.yellow + ' EC2 instance launched';
    var EC2_INSTANCE_TAG_FAIL = '✗'.red + ' EC2 instance tagging failed with %s';
    var EC2_INSTANCE_TAG_SUCCESS = '↗'.blue + ' EC2 instance tagged';

    var AWS = taskData.AWS;
    var _ = require("underscore");
    var util = require('util');
    var done = taskData.async();

    if (taskData.data.ec2 !== undefined) {
        var task = taskData.data.ec2;
        var options = _(grunt.config.get('aws.options') || {}).chain()
                .extend(taskData.data.options || {})
                .extend(taskData.data.ec2.options || {})
                .value();
    }
    else {
        var task = taskData;
    }

    var ami;

    var findAMI = function(options, task) {
        if (task.findAMI) {
            var findAMIOptions = _(_.clone(options)).extend(task.findAMI.options || {});
            if (findAMIOptions.region == 'us-standard') {
                findAMIOptions.region = 'us-east-1';
            }
            AWS.config.update(_.pick(findAMIOptions, 'accessKeyId', 'secretAccessKey', 'region'));
            var ec2 = new AWS.EC2(_.pick(findAMIOptions, 'accessKeyId', 'secretAccessKey', 'region'));

            ec2.describeImages(_.pick(task.findAMI, "Owners","ExecutableUsers","Filters"),
                function(err, data) {
                    if (err) {
                        grunt.fail.warn("Fetching AMI info failed. AWS response: "+ JSON.stringify(err));
                    }
                    else {
                        data.Images.sort(function(a,b){
                            return a.Name < b.Name;
                        });
                        var ami = data.Images[0].ImageId;
                        grunt.log.writeln("Found matching AMI: " + ami );
                    }
            });
        }
    };

    var startEC2 = function(options, task) {
        if (task.startEC2) {
            var startEC2Options = _(_.clone(options)).extend(task.startEC2.options || {});
            if (startEC2Options.region == 'us-standard') {
                startEC2Options.region = 'us-east-1';
            }
            AWS.config.update(_.pick(startEC2Options, 'accessKeyId', 'secretAccessKey', 'region'));
            var ec2 = new AWS.EC2(_.pick(startEC2Options, 'accessKeyId', 'secretAccessKey', 'region'));
            grunt.log.writeln(startEC2Options['UserData']);
            task.startEC2['InstanceType'] = (task.startEC2['InstanceType'] || ami);

            ec2.runInstances(_.pick(task.startEC2, "ImageId", "MinCount", "MaxCount",
                                                   "KeyName", "InstanceType", "UserData"), function(err, data) {
                if (err) {
                    grunt.fail.warn(util.format(EC2_INSTANCE_LAUNCH_SUCCESS, JSON.stringify(err)));
                    done();
                }
                else {
                    grunt.log.writeln(EC2_INSTANCE_LAUNCH_SUCCESS);

                    var instances = new Array();
                    for (var i = 0; i<data.Instances.length; i++) {
                        instances.push(data.Instances[i].InstanceId);
                    }

                    if (task.startEC2.Tags !== undefined) {
                        tagInstances(instances, startEC2Options, task.startEC2.Tags);
                    }
                    else {
                        done();
                    }
                }
            });
        }
    }

    var tagInstances = function(instances, options, tags) {
        if (tags) {
            var ec2 = new AWS.EC2(_.pick(options, 'accessKeyId', 'secretAccessKey', 'region'));
            ec2.createTags({Resources: instances, Tags: tags},
                function(err, data) {
                    if (err) {
                        grunt.fail.warn(util.format(EC2_INSTANCE_TAG_FAIL, JSON.stringify(err)));
                    }
                    else {
                        grunt.log.writeln(EC2_INSTANCE_TAG_SUCCESS);
                    }
                    done();
            });
        }
    }

    var terminateEC2 = function(options, task) {
        if (task.terminateEC2) {
            var terminateEC2Options = _(_.clone(options)).extend(task.terminateEC2.options || {});
            if (terminateEC2Options.region == 'us-standard') {
                terminateEC2Options.region = 'us-east-1';
            }
            AWS.config.update(_.pick(terminateEC2Options, 'accessKeyId', 'secretAccessKey', 'region'));
            var ec2 = new AWS.EC2(_.pick(terminateEC2Options, 'accessKeyId', 'secretAccessKey', 'region'));

            ec2.terminateInstances(_.pick(task.terminateEC2, "InstanceIds"),
                function(err, data) {
                    if (err) {
                        grunt.fail.warn("Terminating EC2 intances failed. AWS response: \n"+ JSON.stringify(err));
                    }
                    else {
                        grunt.log.writeln(JSON.stringify(data));
                    }
            });
        }
    }


    //findAMI(options,task);
    startEC2(options,task);
    //removeFromAmi(options,task);
    //addToAMI(options,task);
    //terminateEC2(options,task);
};