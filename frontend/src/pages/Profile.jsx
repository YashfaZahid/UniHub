
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import './Profile.css';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ bio: '' }); // Name removed from editable data
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function getProfile() {
      const userString = localStorage.getItem('user');
      if (!userString) {
        setLoading(false);
        return; 
      }

      const user = JSON.parse(userString);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        setFormData({ bio: data.bio || '' });
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file || !profile) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      alert("Error uploading: " + uploadError.message);
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ profile_image: data.publicUrl }).eq('id', profile.id);
      window.location.reload(); 
    }
  }

  async function handleSave() {
    if (!profile) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ bio: formData.bio }) // Only updating bio
      .eq('id', profile.id);

    if (!error) {
      setProfile({ ...profile, bio: formData.bio });
      setIsEditing(false);
    } else {
      alert("Error saving: " + error.message);
    }
  }

  if (loading) return <div className="page-wrapper">Loading...</div>;
  if (!profile) return <div className="page-wrapper">Please log in to view your profile.</div>;

  return (
    <div className="page-wrapper">
      <div className="profile-container">
        
        <div className="profile-image-box" onClick={() => fileInputRef.current.click()}>
          <img src={profile.profile_image || "https://placehold.co/150"} alt="Profile" />
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
          <div className="upload-hint">Change Photo</div>
        </div>

        <div className="profile-fields">
          {/* Name - Always Read Only */}
          <div className="field-group">
            <label>Name</label>
            <div className="static-field">{profile.name}</div>
          </div>

          {/* Shop - Logic for "None" or Shop Name */}
          <div className="field-group">
            <label>Shop</label>
            <div className="static-field">
              {profile.has_shop ? (profile.shop_name || "Active Shop") : "None"}
            </div>
          </div>

          {/* Bio - Editable */}
          <div className="field-group">
            <label>Bio</label>
            {isEditing ? (
              <textarea 
                value={formData.bio} 
                onChange={(e) => setFormData({ bio: e.target.value })} 
                className="edit-field textarea"
                placeholder="Write your bio..."
              />
            ) : (
              <div className="static-field bio-text">{profile.bio || "No bio added yet"}</div>
            )}
          </div>
        </div>

        <div className="action-area">
          {isEditing ? (
            <button className="icon-button" onClick={handleSave}>Save Changes</button>
          ) : (
            <button className="icon-button" onClick={() => setIsEditing(true)}>Edit Profile</button>
          )}
        </div>
      </div>
    </div>
  );
}

