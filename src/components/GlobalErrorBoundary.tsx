import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isQuotaError = (this.state.error as any)?.isQuotaError;

      return (
        <div translate="no" className="min-h-screen bg-[#f5f5f0] text-black flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-black/[0.03] border border-black/[0.06] rounded-3xl p-8 text-center space-y-6 shadow-lg shadow-black/[0.03] shadow-black/[0.04]">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold uppercase italic tracking-tight">
                <span>{isQuotaError ? 'Límite de Cuota Alcanzado' : 'Algo salió mal'}</span>
              </h1>
              <p className="text-black/60 italic leading-relaxed">
                <span>{isQuotaError 
                  ? 'Se ha alcanzado el límite diario de escritura en la base de datos gratuita. El servicio se restablecerá mañana.'
                  : 'Ha ocurrido un error inesperado en la aplicación.'}</span>
              </p>
              {!isQuotaError && this.state.error && (
                <div className="mt-4 p-4 bg-black/40 rounded-xl text-left overflow-auto max-h-32">
                  <code className="text-xs text-red-400 font-mono">
                    {this.state.error.message}
                  </code>
                </div>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="w-full bg-brand text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Recargar Aplicación</span>
            </button>
            
            <p className="text-[10px] text-black/30 uppercase tracking-widest font-bold">
              <span>Vida Mixe • Soporte Técnico</span>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
