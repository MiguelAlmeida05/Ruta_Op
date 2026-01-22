class GeoLocationError(Exception):
    """
    Excepción lanzada cuando ocurre un error relacionado con la geolocalización o 
    operaciones con grafos espaciales (OSMnx/NetworkX).
    """
    def __init__(self, message: str, details: str = None):
        self.message = message
        self.details = details
        super().__init__(self.message)
