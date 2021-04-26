from setuptools import setup

setup(
    name='sumo-web3d',
    version='1.0.1',
    description='Web-based 3D Visualization of SUMO Traffic Simulator',
    long_description='See README.md on GitHub: https://github.com/sidewalklabs/sumo-web3d/',
    author='Sidewalk Labs',
    author_email='hello@sidewalklabs.com',
    url='https://github.com/sidewalklabs/sumo-web3d/',
    entry_points={
        'console_scripts': [
            'sumo-web3d = sumo_web3d.server.server:run',
        ],
    },
    include_package_data=True,
    package_data={
        'static': ['sumo_web3d/static/*'],
        'scenarios': ['sumo_web3d/scenarios/*'],
        'scenarios.json': ['sumo_web3d/scenarios.json']
    },
    packages=[
        'sumo_web3d',
        'sumo_web3d.server',
    ],
    install_requires=[
        'aiohttp>=2.2',
        'chardet>=3.0',
        'lxml>=3.8',
        'websockets>=3.4',
        'xmltodict>=0.11',
    ],
)
