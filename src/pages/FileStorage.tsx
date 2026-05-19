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
      const { ref, listAll, getDownloadURL, storage } = await import('../firebase');
      const folderPath = `users/${user.uid}/files/`;
      const storageRef = ref(storage, folderPath);
      
      const res = await listAll(storageRef);
      const fileData = await Promise.all(res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          url
        };
      }));
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
      const { ref, uploadBytesResumable, getDownloadURL, storage } = await import('../firebase');
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `users/${user.uid}/files/${filename}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed',
        () => {},
        (error) => {
          console.error('Error uploading file:', error);
          alert('Error al subir el archivo: ' + error.message);
          setUploading(false);
        },
        async () => {
          await fetchFiles(); // Although files now come from v-uploads...?
          setUploading(false);
        }
      );
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert('Error de red al inicializar la subida: ' + error.message);
      setUploading(false);
    }
  };

  if (!user) return <div className="text-center p-10">Debes iniciar sesión.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-[#f5f5f0] border border-black/[0.06] rounded-3xl mt-10">
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
          <div key={index} className="flex items-center justify-between p-4 bg-black/[0.03] rounded-xl border border-black/[0.06]">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-brand" />
              <span>{file.name}</span>
            </div>
            <a href={file.url} download className="p-2 bg-black/[0.06] rounded-lg hover:bg-black/20">
              <Download className="w-5 h-5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileStorage;
