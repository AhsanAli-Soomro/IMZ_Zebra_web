// lib/chart-setup.js
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale
} from 'chart.js'

ChartJS.register(
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale 
)
