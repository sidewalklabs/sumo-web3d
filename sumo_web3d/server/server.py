#!/usr/bin/env python3
# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import argparse
import asyncio
from collections import Counter
import functools
import json
import os
import re
import shlex
import time

from aiohttp import web
import websockets
import xmltodict

from . import constants # noqa
from .deltas import round_vehicles, diff_dicts
import sumolib
import traci
from .xml_utils import get_only_key, parse_xml_file

tc = traci.constants

parser = argparse.ArgumentParser(description='Run the microsim python server.')
parser.add_argument(
    '-c', '--configuration-file', dest='configuration_file', default='',
    help='Run SUMO3D with a specific configuration. The default is to run ' +
         'with a built-in list of scenarios, e.g. for demoing.')
parser.add_argument(
    '--sumo-args', dest='sumo_args', default='',
    help='Additional arguments to pass to the sumo (or sumo-gui) process. ' +
         'For example, "--step-length 0.01" or "--scale 10".')
parser.add_argument(
    '--gui', action='store_true', default=False,
    help='Run sumo-gui rather than sumo. This is useful for debugging.')

# Base directory for sumo_web3d
DIR = os.path.join(os.path.dirname(__file__), '..')

SCENARIOS_PATH = os.path.join(DIR, 'scenarios.json')
NO_CACHE_HEADER = {'cache-control': 'no-cache'}

# We use these to tell TraCI which parameters we want to track.
TRACI_CONSTANTS = [
    tc.VAR_TYPE,
    tc.VAR_SPEED,
    tc.VAR_ANGLE,
    tc.VAR_LENGTH,
    tc.VAR_WIDTH,
]

TRACI_PERSON_CONSTANTS = TRACI_CONSTANTS + [
    tc.VAR_POSITION,
    tc.VAR_VEHICLE
]

TRACI_VEHICLE_CONSTANTS = TRACI_CONSTANTS + [
    tc.VAR_POSITION3D,
    tc.VAR_SIGNALS,
    tc.VAR_VEHICLECLASS,
]

snapshot = {}
server = None

STATUS_OFF = 'off'
STATUS_RUNNING = 'running'
STATUS_PAUSED = 'paused'
simulation_status = STATUS_OFF
delay_length_ms = 30  # in ms
current_scenario = None
scenarios = {}  # map from kebab-case-name to Scenario object.


last_vehicles = {}
last_lights = {}


# meant to be used as decorator, will not work with coroutines
def send_as_http_response(func):
    def func_wrapper(*args, **kwargs):
        data = func(*args, **kwargs)
        if data and type(data) == str:
            return web.Response(text=data)
        elif data and type(data) != str:
            raise Exception(
                'fail to send as response, expecting string, recieved: {}'.format(type(data))
            )
        else:
            return web.Response(status=404, text='Not found')
    return func_wrapper


# meant to be used as decorator, will not work with coroutines
def serialize_as_json_string(func):
    def func_wrapper(*args, **kwargs):
        data = func(*args, **kwargs)
        if data:
            return json.dumps(data)
        else:
            return None
    return func_wrapper


class Scenario(object):

    @classmethod
    def from_config_json(cls, scenarios_json):
        name = scenarios_json['name']
        config_file = scenarios_json['config_file']
        sumocfg_file = os.path.join(DIR, os.path.expanduser(os.path.expandvars(config_file)))
        is_default = scenarios_json.get('is_default', False)
        config_dir = os.path.dirname(sumocfg_file)
        config = xmltodict.parse(open(sumocfg_file).read(), attr_prefix='')['configuration']
        net_file, additional_files, settings_file = parse_config_file(config_dir, config)
        additionals = {} if additional_files else None
        if additional_files:
            for xml in [parse_xml_file(f) for f in additional_files]:
                additional = xml.get('additional') or xml.get('add')
                if additional:
                    additionals.update(additional)

        settings = parse_xml_file(settings_file)
        water = {'type': 'FeatureCollection', 'features': []}
        if settings:
            water_tag = get_only_key(settings).get('water-geojson')
            if water_tag:
                water = json.load(open(os.path.join(config_dir, water_tag['value'])))

        return cls(
            sumocfg_file,
            name,
            is_default,
            parse_xml_file(net_file),
            additionals,
            settings,
            water
        )

    def __init__(self, config_file, name, is_default, network, additional, settings, water):
        self.config_file = config_file
        self.display_name = name
        self.name = to_kebab_case(name)
        self.is_default = is_default
        self.network = network
        self.additional = additional
        self.settings = settings
        self.water = water


def person_to_dict(person):
    """Extracts relevant information from what traci.person.getSubscriptionResults."""
    return {
        'x': person[tc.VAR_POSITION][0],
        'y': person[tc.VAR_POSITION][1],
        'z': 0,
        'speed': person[tc.VAR_SPEED],
        'angle': person[tc.VAR_ANGLE],
        'type': person[tc.VAR_TYPE],
        'length': person[tc.VAR_LENGTH],
        'width': person[tc.VAR_WIDTH],
        'person': person.get(tc.VAR_VEHICLE),
        'vClass': 'pedestrian',
    }


def vehicle_to_dict(vehicle):
    """Extracts relevant information from what traci.vehicle.getSubscriptionResults."""
    return {
        'x': vehicle[tc.VAR_POSITION3D][0],
        'y': vehicle[tc.VAR_POSITION3D][1],
        'z': vehicle[tc.VAR_POSITION3D][2],
        'speed': vehicle[tc.VAR_SPEED],
        'angle': vehicle[tc.VAR_ANGLE],
        'type': vehicle[tc.VAR_TYPE],
        'length': vehicle[tc.VAR_LENGTH],
        'width': vehicle[tc.VAR_WIDTH],
        'signals': vehicle[tc.VAR_SIGNALS],
        'vClass': vehicle.get(tc.VAR_VEHICLECLASS),
    }


def light_to_dict(light):
    """Extract relevant information from traci.trafficlights.getSubscriptionResults."""
    return {
        'phase': light[tc.TL_CURRENT_PHASE],
        'programID': light[tc.TL_CURRENT_PROGRAM],
    }


def to_kebab_case(scenario_name):
    return scenario_name.lower().replace(' ', '-').replace('_', '-')


def get_state():
    return {
        'delayMs': delay_length_ms,
        'scenario': to_kebab_case(getattr(current_scenario, 'name')),
        'simulationStatus': simulation_status
    }


async def post_state(scenarios, request):
    global current_scenario, delay_length_ms, simulation_status
    body = await request.json()
    if body['scenario'] not in scenarios.keys():
        return None
    current_scenario = scenarios[body['scenario']]
    delay_length_ms = body['delay_length_ms']
    simulation_status = body['simulation_status']
    return web.Response(text=json.dumps({
        'delayMs': delay_length_ms,
        'scenario': to_kebab_case(getattr(current_scenario, 'name')),
        'simulationStatus': simulation_status
    }))


def state_http_response(request):
    return web.Response(
        text=json.dumps(get_state())
    )


def vehicle_route_http_response(request):
    vehicle_id = request.query_string
    vehicle = last_vehicles.get(vehicle_id)
    if vehicle:
        if vehicle['vClass'] == 'pedestrian':
            edge_ids = traci.person.getEdges(vehicle_id)
        else:
            edge_ids = traci.vehicle.getRoute(vehicle_id)
        if edge_ids:
            return web.Response(
                text=json.dumps(edge_ids)
            )
    return web.Response(status=404)


def get_state_websocket_message():
    state = get_state()
    state['type'] = 'state'
    return state


def make_xml_endpoint(path):
    text = None
    if path:
        r = xmltodict.parse(open(path).read(), attr_prefix='')
        text = json.dumps(r)

    async def handler(request):
        if text:
            return web.Response(text=text)
        else:
            return web.Response(status=404, text='Not found')
    return handler


def make_additional_endpoint(paths):
    """Make an endpoint for the "additional-files" setting.

    Since there can be several of these, we read them all and merge the results.
    """
    if not paths:  # Either None or empty list
        return make_xml_endpoint(paths)  # generate a generic 404.
    additionals = {}
    for path in paths:
        r = xmltodict.parse(open(path).read(), attr_prefix='')
        additionals.update(r['additional'])
    text = json.dumps({'additional': additionals})

    async def handler(request):
        return web.Response(text=text)
    return handler


async def run_simulation(websocket):
    while True:
        if simulation_status is STATUS_RUNNING:
            snapshot = simulate_next_step()
            snapshot['type'] = 'snapshot'
            await websocket.send(json.dumps(snapshot))
            await asyncio.sleep(delay_length_ms / 1000)
        else:
            await asyncio.sleep(0)


def cleanup_sumo_simulation(simulation_task):
    global last_lights, last_vehicles
    if simulation_task:
        if simulation_task.cancel():
            simulation_task = None
        last_vehicles = {}
        last_lights = {}
        traci.close()


async def websocket_simulation_control(sumo_start_fn, task, websocket, path):
    # We use globals to communicate with the simulation coroutine for simplicity
    global delay_length_ms
    global simulation_status
    while True:
        try:
            raw_msg = await websocket.recv()
            msg = json.loads(raw_msg)
            if msg['type'] == 'action':
                if msg['action'] == 'start':
                    sumo_start_fn()
                    simulation_status = STATUS_RUNNING
                    loop = asyncio.get_event_loop()
                    task = loop.create_task(run_simulation(websocket))
                elif msg['action'] == 'pause':
                    simulation_status = STATUS_PAUSED
                elif msg['action'] == 'resume':
                    simulation_status = STATUS_RUNNING
                elif msg['action'] == 'cancel':
                    simulation_status = STATUS_OFF
                    cleanup_sumo_simulation(task)
                elif msg['action'] == 'changeDelay':
                    delay_length_ms = msg['delayLengthMs']
                else:
                    raise Exception('unrecognized action websocket message')
                await websocket.send(json.dumps(get_state_websocket_message()))
            else:
                raise Exception('unrecognized websocket message')
        # we need to handle implicit cancelling, ie the client closing their browser
        except websockets.exceptions.ConnectionClosed:
            cleanup_sumo_simulation(task)
            break


# TraCI business logic
def start_sumo_executable(gui, sumo_args, sumocfg_file):
    sumoBinary = sumolib.checkBinary('sumo' if not gui else 'sumo-gui')
    additional_args = shlex.split(sumo_args) if sumo_args else []
    args = [sumoBinary, '-c', sumocfg_file] + additional_args
    print('Executing %s' % ' '.join(args))
    traci.start(args)
    traci.simulation.subscribe()

    # Subscribe to all traffic lights. This set of IDs should never change.
    for light_id in traci.trafficlights.getIDList():
        traci.trafficlights.subscribe(light_id, [
            tc.TL_CURRENT_PHASE,
            tc.TL_CURRENT_PROGRAM
        ])


def simulate_next_step():
    global last_lights, last_vehicles
    start_secs = time.time()
    traci.simulationStep()
    end_sim_secs = time.time()
    # Vehicles
    for veh_id in traci.simulation.getDepartedIDList():
        # SUMO will not resubscribe to vehicles that are already subscribed, so this is safe.
        traci.vehicle.subscribe(veh_id, TRACI_VEHICLE_CONSTANTS)
    vehicle_response = traci.vehicle.getSubscriptionResults().items()
    # Vehicles are automatically unsubscribed upon arrival and deleted from vehicle list on next
    # timestep. Persons are also automatically unsubscribed.
    # See: http://sumo.dlr.de/wiki/TraCI/Object_Variable_Subscription).

    # Workaround for people: traci does not return person objects in the getDepartedIDList() call
    # See: http://sumo.dlr.de/trac.wsgi/ticket/3477
    for ped_id in traci.person.getIDList():
        traci.person.subscribe(ped_id, TRACI_PERSON_CONSTANTS)
    person_response = traci.person.getSubscriptionResults().items()

    vehicles = {veh_id: vehicle_to_dict(v) for veh_id, v in vehicle_response}
    persons = {ped_id: person_to_dict(p) for ped_id, p in person_response}

    # Note: we might have to separate vehicles and people if their data models or usage deviate
    # but for now we'll combine them into a single object
    vehicles.update(persons)
    vehicle_counts = Counter(v['vClass'] for veh_id, v in vehicles.items())
    round_vehicles(vehicles)
    vehicles_update = diff_dicts(last_vehicles, vehicles)

    # Lights
    light_response = traci.trafficlights.getSubscriptionResults().items()
    lights = {light_id: light_to_dict(light) for light_id, light in light_response}
    lights_update = diff_dicts(last_lights, lights)

    end_update_secs = time.time()

    snapshot = {
        'time': traci.simulation.getCurrentTime(),
        'vehicles': vehicles_update,
        'lights': lights_update,
        'vehicle_counts': vehicle_counts,
        'simulate_secs': end_sim_secs - start_secs,
        'snapshot_secs': end_update_secs - end_sim_secs
    }
    last_vehicles = vehicles
    last_lights = lights
    return snapshot


def parse_config_file(config_dir, config):
    input_config = config['input']
    net_file = os.path.join(config_dir, input_config['net-file']['value'])

    additionals = input_config.get('additional-files', [])
    if additionals:
        # With a single additional file, additionals is an OrderedDict.
        # With multiple additional files, it's a list of OrderedDicts.
        # This logic normalizes it to always be the latter.
        # Additionally, files may be specified either via multiple tags or via
        # space-separated or comma-separated file names in the value attribute.
        if not isinstance(additionals, list):
            additionals = [additionals]
        additional_files = []
        for additional in additionals:
            values = re.split(r'[ ,]+', additional['value'])
            for value in values:
                additional_files.append(os.path.join(config_dir, value))
    else:
        additional_files = None

    settings_file = None
    if 'gui_only' in config and 'gui-settings-file' in config['gui_only']:
        settings_file = os.path.join(config_dir, config['gui_only']['gui-settings-file']['value'])
    return (net_file, additional_files, settings_file)


def scenario_to_response_body(scenario):
    return {
        'displayName': scenario.name,
        'kebabCase': to_kebab_case(scenario.name)
    }


def get_scenarios_route(scenarios_file, scenarios):
    scenarios = load_scenarios_file(scenarios, scenarios_file)


@send_as_http_response
@serialize_as_json_string
def scenario_attribute_route(scenarios_file, scenarios, attribute, normalized_key, request):
    requested_scenario = request.match_info['scenario']
    if requested_scenario not in scenarios:
        scenarios = load_scenarios_file(scenarios, scenarios_file)
    if requested_scenario in scenarios:
        obj = getattr(scenarios[requested_scenario], attribute)
        if normalized_key and obj:
            obj = {normalized_key: get_only_key(obj)}
        return obj
    else:
        return None


def load_scenarios_file(prev_scenarios, scenarios_file):
    next_scenarios = prev_scenarios
    if not scenarios_file:
        return next_scenarios

    with open(scenarios_file) as f:
        new_scenarios = json.loads(f.read())
        new_scenarios_names = [to_kebab_case(x['name']) for x in new_scenarios]
        # throw error if there are duplicate name fields
        duplicates = len(new_scenarios_names) == len(set(new_scenarios_names))
        if not duplicates:
            raise Exception(
                'Invalid scenarios.json, cannot have two scenarios with the'
                'same kebab case name'
            )
        prev_scenario_names = set([s.name for s in prev_scenarios.values()])
        updates = [s for s in new_scenarios if to_kebab_case(s['name']) not in prev_scenario_names]
        for new_scenario in updates:
            scenario = Scenario.from_config_json(new_scenario)
            next_scenarios.update({scenario.name: scenario})
        return next_scenarios


def get_new_scenario(request):
    """Set a new scenario and respond with index.html"""
    global current_scenario
    scenario_name = request.match_info['scenario']
    print('Switching to %s' % scenario_name)
    # The simulation will be restarted via a websocket message.
    current_scenario = scenarios[scenario_name]
    # We avoid web.FileResponse here because we want to disable caching.
    html = open(os.path.join(DIR, 'static', 'index.html')).read()
    return web.Response(text=html, content_type='text/html', headers=NO_CACHE_HEADER)


def get_default_scenario_name(scenarios):
    """Find the Scenario with is_default, or a random one."""
    defaults = [k for k, s in scenarios.items() if s.is_default]
    if len(defaults) > 1:
        raise ValueError('Multiple scenarios with is_default set: %s', ', '.join(defaults))
    if len(defaults) == 0:
        return scenarios.keys()[0]  # pick a random scenario
    return defaults[0]


def setup_http_server(task, scenario_file, scenarios):
    app = web.Application()

    scenarios_response = [scenario_to_response_body(x) for x in scenarios.values()]
    default_scenario_name = get_default_scenario_name(scenarios)

    app.router.add_get(
        '/scenarios/{scenario}/additional',
        functools.partial(scenario_attribute_route, scenario_file, scenarios, 'additional', None)
    )
    app.router.add_get(
        '/scenarios/{scenario}/network',
        functools.partial(scenario_attribute_route, scenario_file, scenarios, 'network', None)
    )
    app.router.add_get(
        '/scenarios/{scenario}/water',
        functools.partial(scenario_attribute_route, scenario_file, scenarios, 'water', None)
    )
    app.router.add_get(
        '/scenarios/{scenario}/settings',
        functools.partial(
            scenario_attribute_route, scenario_file, scenarios, 'settings', 'viewsettings')
    )
    app.router.add_get('/scenarios/{scenario}/', get_new_scenario)

    app.router.add_get(
        '/scenarios',
        lambda request: web.Response(text=json.dumps(scenarios_response))
    )
    app.router.add_get(
        '/poly-convert',
        make_xml_endpoint(os.path.join(constants.SUMO_HOME, 'data/typemap/osmPolyconvert.typ.xml'))
    )
    app.router.add_get('/state', state_http_response)
    app.router.add_post('/state', functools.partial(post_state, scenarios))
    app.router.add_get('/vehicle_route', vehicle_route_http_response)
    app.router.add_get('/', lambda req: web.HTTPFound(
        '/scenarios/%s/' % default_scenario_name, headers=NO_CACHE_HEADER))
    app.router.add_static('/', path=os.path.join(DIR, 'static'))

    return app


def main(args):
    global current_scenario, scenarios, SCENARIOS_PATH
    task = None
    sumo_start_fn = functools.partial(start_sumo_executable, args.gui, args.sumo_args)

    if args.configuration_file:
        # Replace the built-in scenarios with a single, user-specified one.
        # We don't merge the lists to avoid clashes with two scenarios having is_default set.
        SCENARIOS_PATH = None
        name = os.path.basename(args.configuration_file)
        scenarios = {
            to_kebab_case(name): Scenario.from_config_json({
                'name': name,
                'description': 'User-specified scenario',
                'config_file': args.configuration_file,
                'is_default': True
            })
        }
    else:
        scenarios = load_scenarios_file({}, SCENARIOS_PATH)

    def setup_websockets_server():
        return functools.partial(
            websocket_simulation_control,
            lambda: sumo_start_fn(getattr(current_scenario, 'config_file')),
            task
        )

    loop = asyncio.get_event_loop()

    # websockets
    ws_handler = setup_websockets_server()
    ws_server = websockets.serve(ws_handler, '0.0.0.0', 5678)

    # http
    app = setup_http_server(task, SCENARIOS_PATH, scenarios)
    http_server = loop.create_server(
        app.make_handler(),
        '0.0.0.0',
        5000
    )

    loop.run_until_complete(http_server)
    loop.run_until_complete(ws_server)

    print("""Listening on:
    127.0.0.1:5000 (HTTP)
    127.0.0.1:5678 (WebSockets)
    """)

    loop.run_forever()


def run():
    args = parser.parse_args()
    main(args)


if __name__ == '__main__':
    run()
