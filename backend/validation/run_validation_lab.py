import os
import sys
import subprocess

def main():
    print("==================================================")
    print("   TuDistri - Sistema de Validación y Explicabilidad")
    print("==================================================")
    print("Este proceso:")
    print(" 1. Generará datos sintéticos usando el motor de simulación actual.")
    print(" 2. Entrenará un modelo de IA para entender el comportamiento.")
    print(" 3. Lanzará un dashboard interactivo en el puerto 8050.")
    print("==================================================")
    
    validation_script = os.path.join("backend", "validation", "explainer_lab.py")
    
    if not os.path.exists(validation_script):
        # Try relative path if running from backend dir
        validation_script = os.path.join("validation", "explainer_lab.py")
        
    try:
        subprocess.run([sys.executable, validation_script], check=True)
    except KeyboardInterrupt:
        print("\nDashboard detenido.")
    except Exception as e:
        print(f"Error ejecutando validación: {e}")

if __name__ == "__main__":
    main()
