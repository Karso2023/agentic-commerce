from enum import Enum


class Category(str, Enum):
    # Skiing / outdoor
    JACKET = "jacket"
    PANTS = "pants"
    BASE_LAYER_TOP = "base_layer_top"
    BASE_LAYER_BOTTOM = "base_layer_bottom"
    GLOVES = "gloves"
    GOGGLES = "goggles"
    HELMET = "helmet"
    SOCKS = "socks"
    NECK_GAITER = "neck_gaiter"
    # General shopping
    HEADSET = "headset"
    MONITOR = "monitor"
    KEYBOARD = "keyboard"
    LAPTOP = "laptop"
    RUNNING_SHOES = "running_shoes"
    SNEAKERS = "sneakers"
    T_SHIRT = "t_shirt"
    HOODIE = "hoodie"
    BAG = "bag"
    WATCH = "watch"
    DESK_CHAIR = "desk_chair"
    WEBCAM = "webcam"
    PHONE = "phone"
    TABLET = "tablet"
    SPEAKERS = "speakers"
    GPU = "gpu"
    # Hackathon / events
    SNACKS = "snacks"
    BADGES = "badges"
    ADAPTERS = "adapters"
    DECORATIONS = "decorations"
    PRIZES = "prizes"
    CUSTOM = "custom"  # single item added from liked / manual


class Priority(str, Enum):
    MUST_HAVE = "must_have"
    NICE_TO_HAVE = "nice_to_have"
