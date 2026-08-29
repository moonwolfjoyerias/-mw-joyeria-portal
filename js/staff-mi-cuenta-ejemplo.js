// MW JOYERÍA — Mi cuenta (Staff): personal y nómina
// DATOS DE EJEMPLO
// ⚠️ TEMPORAL: se reemplazará por Firestore en Fase 3.
//
// Según el documento de requisitos (Sección 17), la nómina es solo para
// Staff (8 personas), Administrativos y RH. Cada quien ve ÚNICAMENTE su
// propio recibo, y para Staff (cuenta compartida del dispositivo) esto
// exige capturar nombre + contraseña individual antes de mostrarlo.
//
// IMPORTANTE:
// Las credenciales de abajo son únicamente para simulación.
// En producción se utilizará autenticación real.

const PERSONAL_STAFF_EJEMPLO = [
  { usuario: 'staff01', nombre: 'Ana López', password: '1234' },
  { usuario: 'staff02', nombre: 'Mariana Torres', password: '1234' },
  { usuario: 'staff03', nombre: 'Carlos Reyes', password: '1234' },
  { usuario: 'staff04', nombre: 'Fernanda Ibarra', password: '1234' },
  { usuario: 'staff05', nombre: 'Jorge Salinas', password: '1234' },
  { usuario: 'staff06', nombre: 'Paulina Gómez', password: '1234' },
  { usuario: 'staff07', nombre: 'Luis Medina', password: '1234' },
  { usuario: 'MW0005', nombre: 'María Camila Sánchez Calles', password: '2896' }
];

const NOMINA_SEMANA_ACTUAL = {
  periodo: '24 - 30 de agosto de 2026',
  diasTrabajados: 6,
  sueldoBase: 1800,
  bonos: 150,
  deducciones: 50,
  get totalPagar() {
    return this.sueldoBase + this.bonos - this.deducciones;
  }
};
