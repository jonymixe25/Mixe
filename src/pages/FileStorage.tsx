import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, addDoc, collection, serverTimestamp } from '../firebase';
import { Folder, Upload, Download, FileText, Trash2 } from 'lucide-react';

const FileStorage: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchFiles();
  }, [user]);

  const fetchFiles = async () => {
    if (!user) return;
    try {
      const folderPath = `users/${user.uid}/files`;
      const response = await fetch(`/api/files/${folderPath}`);
      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al obtener archivos');
        }
        throw new Error(`Servidor respondió con status: ${response.status}`);
      }

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Respuesta no válida del servidor (JSON esperado).');
      }

      const fileData = await response.json();
      setFiles(fileData);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('folder', `users/${user.uid}/files`);
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error en la subida');
        }
        throw new Error(`Error del servidor: ${response.status}`);
      }

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Respuesta no válida del servidor (JSON esperado).');
      }
      
      await fetchFiles();
      setUploading(false);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo: ' + error.message);
      setUploading(false);
    }
  };

  if (!user) return <div className="text-center p-10">Debes iniciar sesión.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-[#0a0502] border border-white/10 rounded-3xl mt-10">
      <h2 className="text-3xl font-bold mb-6">Mis Archivos</h2>
      <div className="mb-6">
        <label className="cursor-pointer bg-brand p-3 rounded-xl font-bold flex items-center gap-2 w-fit">
          <Upload className="w-5 h-5" />
          {uploading ? 'Subiendo...' : 'Subir Archivo'}
          <input type="file" onChange={handleUpload} className="hidden" />
        </label>
      </div>
      <div className="space-y-4">
        {files.map((file, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-brand" />
              <span>{file.name}</span>
            </div>
            <a href={file.url} download className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
              <Download className="w-5 h-5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileStorage;
